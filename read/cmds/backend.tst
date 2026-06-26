$exclude = @('venv','__pycache__','.git')

$output = "FULL_BACKEND_DOCUMENT.txt"
Remove-Item $output -Force -ErrorAction SilentlyContinue

Get-ChildItem -Directory | Where-Object { $_.Name -notin $exclude } | ForEach-Object {

    # Folder header
    "==================================================" | Out-File -Append -Encoding utf8 $output
    "FOLDER: $($_.Name)" | Out-File -Append -Encoding utf8 $output
    "==================================================" | Out-File -Append -Encoding utf8 $output
    "" | Out-File -Append -Encoding utf8 $output

    Get-ChildItem $_.FullName -File -Recurse | ForEach-Object {

        # File header
        "FILE: $($_.FullName)" | Out-File -Append -Encoding utf8 $output
        "--------------------------------" | Out-File -Append -Encoding utf8 $output

        # File content
        Get-Content $_.FullName | Out-File -Append -Encoding utf8 $output

        "" | Out-File -Append -Encoding utf8 $output
    }

    "" | Out-File -Append -Encoding utf8 $output
}