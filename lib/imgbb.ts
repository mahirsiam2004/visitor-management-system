export const IMGBB_API_KEY = '23b0f350938eea98c8a9ba4fabe7635b'

export interface ImgbbUploadResult {
  success: boolean
  url?: string
  displayUrl?: string
  deleteUrl?: string
  error?: string
}

/**
 * Upload an image file or base64 string to ImgBB
 * @param image File, Blob, or base64 string
 * @param expiration Optional expiration in seconds (e.g. 600)
 */
export async function uploadToImgBB(
  image: File | Blob | string,
  expiration?: number
): Promise<ImgbbUploadResult> {
  try {
    const formData = new FormData()
    if (typeof image === 'string') {
      // Remove data:image/...;base64, prefix if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
      formData.append('image', base64Data)
    } else {
      formData.append('image', image)
    }

    let url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`
    if (expiration) {
      url += `&expiration=${expiration}`
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (data.success && data.data?.url) {
      return {
        success: true,
        url: data.data.url,
        displayUrl: data.data.display_url || data.data.url,
        deleteUrl: data.data.delete_url,
      }
    }

    return {
      success: false,
      error: data.error?.message || 'Failed to upload image to ImgBB',
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while uploading image',
    }
  }
}
