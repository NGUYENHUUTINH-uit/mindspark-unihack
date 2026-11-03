$docxPath = "c:\UIT\UniHack\MindSpark_Execution_Plan.docx"
$pdfPath = "c:\UIT\UniHack\MindSpark_Execution_Plan.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($docxPath)
    $wdFormatPDF = 17
    $doc.SaveAs([ref]$pdfPath, [ref]$wdFormatPDF)
    $doc.Close()
    Write-Host "PDF plan converted successfully: $pdfPath"
}
catch {
    Write-Error $_
}
finally {
    $word.Quit()
}
