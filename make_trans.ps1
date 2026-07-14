Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap("logo.png")
$bgColor = $bmp.GetPixel(0, 0)
$bmp.MakeTransparent($bgColor)
$bmp.Save("logo_transparent.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
