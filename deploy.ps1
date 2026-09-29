# Automated Cloudflare Deployment Script
param (
    [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN,
    [string]$ProjectName = "homework-tracker"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Deploying to Cloudflare Pages" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Check & Build
Write-Host "`n📦 [1/3] Building production bundle..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting deployment." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Check Token
if (-not $ApiToken) {
    Write-Host "`n⚠️ CLOUDFLARE_API_TOKEN not found in environment." -ForegroundColor Yellow
    Write-Host "Checking local Wrangler authentication..." -ForegroundColor Yellow
    npx.cmd wrangler whoami
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n🔑 Please log in to Cloudflare by running:" -ForegroundColor Cyan
        Write-Host "   npx wrangler login" -ForegroundColor Green
        Write-Host "or set your token:" -ForegroundColor Cyan
        Write-Host "   `$env:CLOUDFLARE_API_TOKEN='your_api_token'`n" -ForegroundColor Green
        exit 1
    }
} else {
    $env:CLOUDFLARE_API_TOKEN = $ApiToken
}

# 3. Deploy
Write-Host "`n🌐 [2/3] Deploying 'dist' folder to Cloudflare Pages project: $ProjectName..." -ForegroundColor Yellow
npx.cmd wrangler pages deploy dist --project-name=$ProjectName --branch=main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ [3/3] Deployment succeeded! Your app is live on Cloudflare." -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed. Please check the logs above." -ForegroundColor Red
}
