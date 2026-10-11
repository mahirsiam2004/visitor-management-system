import { NextRequest, NextResponse } from 'next/server'
import { uploadToImgBB } from '@/lib/imgbb'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') || formData.get('file')
    const expirationStr = formData.get('expiration')
    const expiration = expirationStr ? Number(expirationStr) : undefined

    if (!file) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 })
    }

    const result = await uploadToImgBB(file as File | string, expiration)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Upload failed' }, { status: 500 })
  }
}
