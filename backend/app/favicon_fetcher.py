import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import base64


def get_favicon_url(site_url: str) -> str | None:
    """
    Try to get the favicon URL for a website.
    Returns a data URL or external URL.
    """
    if not site_url:
        return None
    
    try:
        parsed = urlparse(site_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # First try common favicon locations
        common_paths = [
            '/favicon.ico',
            '/favicon.png',
            '/apple-touch-icon.png',
        ]
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        for path in common_paths:
            try:
                favicon_url = urljoin(base_url, path)
                response = requests.get(favicon_url, headers=headers, timeout=5)
                if response.status_code == 200 and len(response.content) > 0:
                    # Convert to data URL to avoid CORS issues
                    content_type = response.headers.get('Content-Type', 'image/x-icon')
                    b64_data = base64.b64encode(response.content).decode('utf-8')
                    return f"data:{content_type};base64,{b64_data}"
            except:
                continue
        
        # Try to parse HTML for favicon link
        try:
            response = requests.get(site_url, headers=headers, timeout=5)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Look for various favicon declarations
                icon_link = soup.find('link', rel=lambda r: r and 'icon' in r.lower())
                if icon_link and icon_link.get('href'):
                    favicon_url = urljoin(base_url, icon_link['href'])
                    try:
                        icon_response = requests.get(favicon_url, headers=headers, timeout=5)
                        if icon_response.status_code == 200:
                            content_type = icon_response.headers.get('Content-Type', 'image/x-icon')
                            b64_data = base64.b64encode(icon_response.content).decode('utf-8')
                            return f"data:{content_type};base64,{b64_data}"
                    except:
                        pass
        except:
            pass
        
        # Fallback to Google's favicon service
        return f"https://www.google.com/s2/favicons?domain={parsed.netloc}&sz=32"
        
    except Exception as e:
        print(f"Error fetching favicon for {site_url}: {e}")
        return None
