import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') || formData.get('file')
    const requestedBucket = (formData.get('bucket') as string) || 'guest-photos'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: 'Storage credentials not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Select valid bucket
    const bucket = ['guest-photos', 'staff-photos', 'entry-photos'].includes(requestedBucket)
      ? requestedBucket
      : 'guest-photos'

    let buffer: Buffer
    let contentType = 'image/jpeg'
    let ext = 'jpg'

    if (typeof file === 'string') {
      // base64 data string
      const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        contentType = matches[1]
        buffer = Buffer.from(matches[2], 'base64')
        ext = contentType.split('/')[1] || 'jpg'
      } else {
        buffer = Buffer.from(file, 'base64')
      }
    } else {
      // File / Blob
      contentType = file.type || 'image/jpeg'
      const nameParts = file.name ? file.name.split('.') : []
      if (nameParts.length > 1) {
        ext = nameParts.pop() || 'jpg'
      }
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      // Fallback to guest-photos if another bucket failed
      if (bucket !== 'guest-photos') {
        const { error: fallbackError } = await supabase.storage
          .from('guest-photos')
          .upload(filename, buffer, { contentType, upsert: true })

        if (!fallbackError) {
          const { data: pub } = supabase.storage.from('guest-photos').getPublicUrl(filename)
          return NextResponse.json({ success: true, url: pub.publicUrl, displayUrl: pub.publicUrl })
        }
      }
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })
    }

    const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(filename)
    return NextResponse.json({
      success: true,
      url: pubUrl.publicUrl,
      displayUrl: pubUrl.publicUrl,
    })
  } catch (err: any) {
    console.error('Upload endpoint error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Upload failed' }, { status: 500 })
  }
}
