"""
Location routes — provides India states, cities per state, and geocoding.

GET /api/location/states
GET /api/location/cities?state=Tamil Nadu
GET /api/location/geocode?city=Salem&state=Tamil Nadu
"""
import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/location", tags=["Location"])

# ── India States + Major Cities Dataset ───────────────────────────────────────
INDIA_CITIES: dict[str, list[str]] = {
    "Andhra Pradesh": [
        "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool",
        "Rajahmundry", "Tirupati", "Kakinada", "Anantapur", "Kadapa",
        "Eluru", "Ongole", "Nandyal", "Machilipatnam", "Chittoor",
    ],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tezpur"],
    "Assam": [
        "Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon",
        "Tinsukia", "Tezpur", "Karimganj",
    ],
    "Bihar": [
        "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia",
        "Darbhanga", "Arrah", "Begusarai", "Katihar", "Munger",
        "Chhapra", "Sitamarhi", "Hajipur", "Bihar Sharif",
    ],
    "Chhattisgarh": [
        "Raipur", "Bhilai", "Bilaspur", "Korba", "Durg",
        "Rajnandgaon", "Jagdalpur", "Ambikapur",
    ],
    "Goa": ["Panaji", "Vasco da Gama", "Margao", "Mapusa", "Ponda"],
    "Gujarat": [
        "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar",
        "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Morbi",
        "Mehsana", "Surendranagar", "Bharuch", "Navsari", "Botad",
    ],
    "Haryana": [
        "Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar",
        "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula",
        "Bhiwani", "Sirsa", "Bahadurgarh", "Jind", "Fatehabad",
    ],
    "Himachal Pradesh": [
        "Shimla", "Solan", "Dharamshala", "Mandi", "Kullu",
        "Hamirpur", "Una", "Bilaspur",
    ],
    "Jharkhand": [
        "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar",
        "Phusro", "Hazaribagh", "Giridih", "Ramgarh", "Dumka",
    ],
    "Karnataka": [
        "Bengaluru", "Hubli-Dharwad", "Mysuru", "Mangaluru", "Belagavi",
        "Kalaburagi", "Davangere", "Ballari", "Vijayapura", "Shivamogga",
        "Tumkur", "Raichur", "Bidar", "Hassan", "Gadag-Betigeri",
    ],
    "Kerala": [
        "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
        "Kannur", "Palakkad", "Malappuram", "Alappuzha", "Kottayam",
        "Pathanamthitta", "Idukki", "Wayanad",
    ],
    "Madhya Pradesh": [
        "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain",
        "Sagar", "Dewas", "Satna", "Ratlam", "Rewa",
        "Murwara", "Singrauli", "Burhanpur", "Khandwa", "Bhind",
    ],
    "Maharashtra": [
        "Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad",
        "Solapur", "Kolhapur", "Amravati", "Nanded", "Jalgaon",
        "Akola", "Latur", "Dhule", "Ahmednagar", "Chandrapur",
        "Satara", "Ratnagiri", "Yavatmal", "Osmanabad",
    ],
    "Manipur": ["Imphal", "Thoubal", "Bishnupur", "Senapati"],
    "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongstoin"],
    "Mizoram": ["Aizawl", "Lunglei", "Saiha"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung"],
    "Odisha": [
        "Bhubaneswar", "Cuttack", "Rourkela", "Brahmapur", "Sambalpur",
        "Puri", "Balasore", "Bhadrak", "Baripada", "Jharsuguda",
    ],
    "Punjab": [
        "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
        "Hoshiarpur", "Mohali", "Pathankot", "Moga", "Firozpur",
        "Fazilka", "Gurdaspur", "Sangrur",
    ],
    "Rajasthan": [
        "Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer",
        "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Sri Ganganagar",
        "Sikar", "Pali", "Nagaur", "Barmer", "Jhunjhunu",
    ],
    "Sikkim": ["Gangtok", "Namchi", "Pelling"],
    "Tamil Nadu": [
        "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
        "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Tiruppur",
        "Dindigul", "Thanjavur", "Ranipet", "Sivakasi", "Karur",
        "Udhagamandalam", "Hosur", "Nagercoil", "Kanchipuram", "Kumbakonam",
    ],
    "Telangana": [
        "Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar",
        "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet",
    ],
    "Tripura": ["Agartala", "Udaipur", "Dharmanagar"],
    "Uttar Pradesh": [
        "Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut",
        "Allahabad", "Ghaziabad", "Bareilly", "Moradabad", "Saharanpur",
        "Gorakhpur", "Firozabad", "Jhansi", "Mathura", "Hapur",
        "Muzaffarnagar", "Aligarh", "Rampur", "Shahjahanpur", "Farrukhabad",
    ],
    "Uttarakhand": [
        "Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur",
        "Kashipur", "Rishikesh", "Mussoorie",
    ],
    "West Bengal": [
        "Kolkata", "Asansol", "Siliguri", "Durgapur", "Bardhaman",
        "Malda", "Barasat", "Kharagpur", "Haldia", "Raiganj",
        "Krishnanagar", "Jalpaiguri",
    ],
    "Jammu and Kashmir": [
        "Srinagar", "Jammu", "Anantnag", "Sopore", "Udhampur",
    ],
    "Ladakh": ["Leh", "Kargil"],
    "Delhi": ["New Delhi", "Delhi"],
    "Chandigarh": ["Chandigarh"],
    "Puducherry": ["Puducherry", "Karaikal"],
    "Andaman and Nicobar Islands": ["Port Blair"],
    "Lakshadweep": ["Kavaratti"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
}


@router.get("/states")
def list_states() -> list[str]:
    """Return all Indian states and UTs in alphabetical order."""
    return sorted(INDIA_CITIES.keys())


@router.get("/cities")
def list_cities(state: str = Query(..., description="State name")) -> list[str]:
    """Return cities for the given state."""
    cities = INDIA_CITIES.get(state)
    if cities is None:
        raise HTTPException(status_code=404, detail=f"State '{state}' not found")
    return sorted(cities)


@router.get("/geocode")
async def geocode_city(
    city: str = Query(..., description="City name"),
    state: str = Query(..., description="State name"),
) -> dict:
    """
    Geocode a city using OpenStreetMap Nominatim.
    Returns { lat, lng, displayName }.
    Falls back to a best-effort lookup from a curated dataset.
    """
    query = f"{city}, {state}, India"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": "AgriIQ/2.0 (agricultural-intelligence-platform)"},
            )
            resp.raise_for_status()
            results = resp.json()
            if results:
                r = results[0]
                return {
                    "lat": float(r["lat"]),
                    "lng": float(r["lon"]),
                    "displayName": r.get("display_name", query),
                    "source": "nominatim",
                }
    except Exception as exc:
        logger.warning("Nominatim geocode failed for '%s': %s", query, exc)

    # Fallback: curated approximate coordinates for major Indian cities
    fallback = _fallback_coords(city, state)
    if fallback:
        return {**fallback, "source": "fallback"}

    raise HTTPException(
        status_code=404,
        detail=f"Could not geocode '{city}, {state}'. Please try another city.",
    )


# ── Fallback coordinates for common cities ────────────────────────────────────
_FALLBACK: dict[str, tuple[float, float]] = {
    "mumbai": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "nashik": (19.9975, 73.7898),
    "nagpur": (21.1458, 79.0882),
    "chennai": (13.0827, 80.2707),
    "coimbatore": (11.0168, 76.9558),
    "salem": (11.6643, 78.1460),
    "madurai": (9.9252, 78.1198),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "delhi": (28.7041, 77.1025),
    "new delhi": (28.6139, 77.2090),
    "kolkata": (22.5726, 88.3639),
    "ahmedabad": (23.0225, 72.5714),
    "surat": (21.1702, 72.8311),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "patna": (25.5941, 85.1376),
    "bhopal": (23.2599, 77.4126),
    "indore": (22.7196, 75.8577),
    "ludhiana": (30.9010, 75.8573),
    "amritsar": (31.6340, 74.8723),
    "ranchi": (23.3441, 85.3096),
    "bhubaneswar": (20.2961, 85.8245),
    "guwahati": (26.1445, 91.7362),
    "thiruvananthapuram": (8.5241, 76.9366),
    "kochi": (9.9312, 76.2673),
    "visakhapatnam": (17.6868, 83.2185),
    "vijayawada": (16.5062, 80.6480),
}


def _fallback_coords(city: str, state: str) -> dict | None:
    key = city.lower().strip()
    coords = _FALLBACK.get(key)
    if coords:
        return {"lat": coords[0], "lng": coords[1], "displayName": f"{city}, {state}, India"}
    return None
