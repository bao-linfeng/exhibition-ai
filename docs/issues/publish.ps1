param([string]$Repository = 'bao-linfeng/exhibition-ai')
$ErrorActionPreference = 'Stop'
if ($Repository -ne 'bao-linfeng/exhibition-ai') { throw 'This publication package targets bao-linfeng/exhibition-ai only.' }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$utf8 = [Text.UTF8Encoding]::new($false)
function Invoke-GhJson([string[]]$Arguments) {
    $raw = & gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "gh failed: $($Arguments[0]) $($Arguments[1]); inspect remote state before retrying." }
    return (($raw -join "`n") | ConvertFrom-Json)
}
function Save-Manifest {
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 30) + "`n", $utf8)
}
$repo = Invoke-GhJson -Arguments @('api', "repos/$Repository")
if ($repo.full_name -ne $Repository -or -not $repo.has_issues -or $repo.archived) { throw 'Repository is not available for issue creation.' }
$existing = @(Invoke-GhJson -Arguments @('issue','list','--repo',$Repository,'--state','all','--limit','1000','--json','number,title,body,url,state'))
if ($existing.Count -ge 1000) { throw 'Issue listing cap reached; paginate before continuing.' }
$manifest.repository = $Repository
$manifest.defaultBranch = $repo.default_branch
$manifest.publicationStatus = 'publishing'
Save-Manifest
$expected = @{}
foreach ($task in $manifest.tasks) {
    $marker = "<!-- task-id: $($task.id) -->"
    $matches = @($existing | Where-Object { $_.body.Contains($marker) -or $_.title -match ('^\[' + $task.id + '\]') })
    if ($matches.Count -gt 1) { throw "Duplicate remote task $($task.id); reconcile manually." }
    if ($task.issueNumber -and ($matches.Count -ne 1 -or $matches[0].number -ne $task.issueNumber)) { throw "Saved issue mapping differs for $($task.id)." }
    $dependencyLinks = @()
    foreach ($dependencyId in $task.deps) {
        $dependency = $manifest.tasks | Where-Object id -eq $dependencyId
        if (-not $dependency.issueNumber -or -not $dependency.issueUrl) { throw "Unpublished dependency $dependencyId for $($task.id)." }
        $dependencyLinks += "[$dependencyId #$($dependency.issueNumber)]($($dependency.issueUrl))"
    }
    $dependencyLine = if ($dependencyLinks.Count) { '前置任务：' + ($dependencyLinks -join '、') } else { '前置任务：无' }
    $bodyPath = Join-Path $root $task.bodyFile
    $body = Get-Content -LiteralPath $bodyPath -Raw
    $body = [regex]::Replace($body, '(?m)^前置任务：[^\r\n]*', $dependencyLine)
    $body = [regex]::Replace($body, '(?m)^GitHub Issue：[^\r\n]*', 'PR：尚未创建。')
    $body = $body.Replace("`r`n", "`n").TrimEnd() + "`n"
    $title = "[$($task.id)][$($task.phase)] $($task.title)"
    if ($matches.Count -eq 1) {
        $issue = $matches[0]
        if ($issue.title -ne $title -or $issue.body.Replace("`r`n", "`n").TrimEnd() -ne $body.TrimEnd()) { throw "Existing issue $($issue.number) differs from prepared content; review before overwriting." }
    } else {
        $tempPath = [IO.Path]::GetTempFileName()
        try {
            [IO.File]::WriteAllText($tempPath, $body, $utf8)
            $created = & gh issue create --repo $Repository --title $title --body-file $tempPath
            if ($LASTEXITCODE -ne 0) { throw "Creation failed for $($task.id); next run must query remote before retry." }
            $url = ($created -join "`n").Trim()
            if ($url -notmatch '^https://github\.com/bao-linfeng/exhibition-ai/issues/(\d+)$') { throw 'Unexpected creation response; inspect repository before retry.' }
            $issue = [pscustomobject]@{ number = [int]$Matches[1]; url = $url; title = $title; body = $body; state = 'OPEN' }
            $existing += $issue
        } finally {
            if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath }
        }
    }
    $task.issueNumber = $issue.number
    $task.issueUrl = $issue.url
    Save-Manifest
    $localBody = [regex]::Replace($body, '(?m)^PR：尚未创建。', "GitHub Issue：[#$($issue.number)]($($issue.url))；PR：尚未创建。")
    [IO.File]::WriteAllText($bodyPath, $localBody, $utf8)
    $expected[[string]$issue.number] = @{ title = $title; body = $body; id = $task.id }
    Write-Output "$($task.id) -> #$($issue.number) $($issue.url)"
}
$verified = @(Invoke-GhJson -Arguments @('issue','list','--repo',$Repository,'--state','all','--limit','1000','--json','number,title,body,url,state'))
foreach ($number in $expected.Keys) {
    $remote = @($verified | Where-Object { [string]$_.number -eq $number })
    if ($remote.Count -ne 1 -or $remote[0].title -ne $expected[$number].title -or $remote[0].body.Replace("`r`n", "`n").TrimEnd() -ne $expected[$number].body.TrimEnd()) { throw "Post-publication verification failed for #$number." }
}
$manifest.publicationStatus = 'published_verified'
Save-Manifest
Write-Output "Verified $($expected.Count) issue titles, bodies and dependency links. Implementation checkboxes remain unchecked."
