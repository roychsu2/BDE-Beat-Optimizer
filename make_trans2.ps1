Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap("logo.png")
$width = $bmp.Width
$height = $bmp.Height
for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        # Check if pixel is close to white (e.g., R > 240, G > 240, B > 240)
        if ($pixel.R -gt 240 -and $pixel.G -gt 240 -and $pixel.B -gt 240) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}
$bmp.Save("logo_transparent2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
