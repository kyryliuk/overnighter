export interface PinPhoto {
  id: string
  checkInId: string
  cdnUrl: string
  createdAt: string
}

export interface PhotoUploadRequest {
  pinId: string
  checkInId: string
  fileType: string
}
