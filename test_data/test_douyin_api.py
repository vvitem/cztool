import requests
import json

def test_douyin_api():
    url = "https://api.douyin.wtf/api/hybrid/video_data"
    params = {
        "url": "https://www.douyin.com/video/7436212741456629050"
    }
    
    try:
        response = requests.get(url, params=params)
        print(f"Status Code: {response.status_code}")
        print("\nResponse Headers:")
        for key, value in response.headers.items():
            print(f"{key}: {value}")
            
        print("\nResponse Body:")
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print("Raw response:", response.text)

if __name__ == "__main__":
    test_douyin_api()
