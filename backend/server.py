from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import httpx
import aiofiles
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'agharia_social_hub')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'agharia-social-hub-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 30  # 30 days

# 2factor.in Configuration
TWOFACTOR_API_KEY = os.environ.get('TWOFACTOR_API_KEY', 'f2a70505-f6a7-11f0-a6b2-0200cd936042')
TWOFACTOR_TEMPLATE = os.environ.get('TWOFACTOR_TEMPLATE', 'OTP1')

# File Upload Configuration
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / 'avatars').mkdir(exist_ok=True)
(UPLOAD_DIR / 'posts').mkdir(exist_ok=True)
(UPLOAD_DIR / 'stories').mkdir(exist_ok=True)
(UPLOAD_DIR / 'messages').mkdir(exist_ok=True)

# Admin phone number
ADMIN_PHONE = '7326937200'

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Pydantic Models ==============

class OTPRequest(BaseModel):
    phone: str

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str
    mode: Optional[str] = None  # 'register' or 'forgot'

class RegisterRequest(BaseModel):
    phone: str
    email: str
    username: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    identifier: str  # phone, email, or username
    password: str

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[str] = None
    avatar_url: Optional[str] = None

class PostCreate(BaseModel):
    caption: Optional[str] = None
    location: Optional[str] = None
    media_type: str = 'image'
    comments_enabled: bool = True

class CommentCreate(BaseModel):
    content: str

class StoryCreate(BaseModel):
    media_type: str = 'image'
    duration: int = 5

class MessageCreate(BaseModel):
    content: str
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    shared_post_id: Optional[str] = None

class PasswordResetRequest(BaseModel):
    phone: str
    new_password: str

class ContactQueryCreate(BaseModel):
    query: str

class UserResponse(BaseModel):
    id: str
    user_id: str
    phone: str
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    dob: Optional[str] = None
    is_disabled: bool = False
    created_at: str

class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse

# ============== Helper Functions ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'exp': expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        
        profile = await db.profiles.find_one({'user_id': user_id})
        if not profile:
            raise HTTPException(status_code=401, detail="User not found")
        
        return profile
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(authorization: str = None):
    """Returns user if token provided and valid, None otherwise"""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except:
        return None

def generate_otp() -> str:
    import random
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

async def send_otp_sms(phone: str, otp: str) -> bool:
    """Send OTP via 2factor.in"""
    try:
        url = f"https://2factor.in/API/V1/{TWOFACTOR_API_KEY}/SMS/+91{phone}/AUTOGEN/{TWOFACTOR_TEMPLATE}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            data = response.json()
            logger.info(f"2factor.in response: {data}")
            return data.get('Status') == 'Success'
    except Exception as e:
        logger.error(f"Error sending OTP: {e}")
        return False

async def verify_otp_2factor(session_id: str, otp: str) -> bool:
    """Verify OTP via 2factor.in"""
    try:
        url = f"https://2factor.in/API/V1/{TWOFACTOR_API_KEY}/SMS/VERIFY/{session_id}/{otp}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            data = response.json()
            logger.info(f"2factor.in verify response: {data}")
            return data.get('Status') == 'Success'
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        return False

# ============== Auth Routes ==============

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to phone number"""
    phone = request.phone.strip()
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    try:
        # Call 2factor.in API
        url = f"https://2factor.in/API/V1/{TWOFACTOR_API_KEY}/SMS/+91{phone}/AUTOGEN/{TWOFACTOR_TEMPLATE}"
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url, timeout=15.0)
            data = response.json()
            logger.info(f"2factor.in response for {phone}: {data}")
            
            if data.get('Status') == 'Success':
                # Store session ID for verification
                session_id = data.get('Details')
                await db.phone_otps.update_one(
                    {'phone': phone},
                    {
                        '$set': {
                            'phone': phone,
                            'session_id': session_id,
                            'created_at': datetime.utcnow().isoformat(),
                            'expires_at': (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
                            'verified': False
                        }
                    },
                    upsert=True
                )
                return {"message": "OTP sent successfully", "success": True}
            else:
                raise HTTPException(status_code=400, detail=data.get('Details', 'Failed to send OTP'))
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout. Please try again.")
    except Exception as e:
        logger.error(f"Error sending OTP: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerifyRequest):
    """Verify OTP"""
    phone = request.phone.strip()
    otp = request.otp.strip()
    
    if len(otp) != 6 or not otp.isdigit():
        raise HTTPException(status_code=400, detail="Invalid OTP format")
    
    # Get stored session
    otp_record = await db.phone_otps.find_one({'phone': phone})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP request found. Please request a new OTP.")
    
    session_id = otp_record.get('session_id')
    if not session_id:
        raise HTTPException(status_code=400, detail="Invalid session. Please request a new OTP.")
    
    try:
        # Verify with 2factor.in
        url = f"https://2factor.in/API/V1/{TWOFACTOR_API_KEY}/SMS/VERIFY/{session_id}/{otp}"
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url, timeout=15.0)
            data = response.json()
            logger.info(f"2factor.in verify response: {data}")
            
            if data.get('Status') == 'Success':
                # Mark as verified
                await db.phone_otps.update_one(
                    {'phone': phone},
                    {'$set': {'verified': True}}
                )
                return {"success": True, "message": "OTP verified successfully"}
            else:
                raise HTTPException(status_code=400, detail="Invalid OTP")
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Verification timeout. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new user"""
    phone = request.phone.strip()
    email = request.email.strip().lower()
    username = request.username.strip().lower()
    
    # Check if phone OTP was verified
    otp_record = await db.phone_otps.find_one({'phone': phone, 'verified': True})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Phone not verified. Please verify OTP first.")
    
    # Check for existing users
    existing = await db.profiles.find_one({
        '$or': [
            {'phone': phone},
            {'email': email},
            {'username': username}
        ]
    })
    
    if existing:
        if existing.get('phone') == phone:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        if existing.get('email') == email:
            raise HTTPException(status_code=400, detail="Email already registered")
        if existing.get('username') == username:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    # Hash password
    hashed_password = hash_password(request.password)
    
    # Create auth record
    auth_record = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'email': email,
        'password_hash': hashed_password,
        'created_at': now
    }
    await db.auth.insert_one(auth_record)
    
    # Create profile
    profile = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'phone': phone,
        'email': email,
        'username': username,
        'full_name': request.full_name.strip(),
        'avatar_url': None,
        'bio': None,
        'dob': None,
        'is_disabled': False,
        'created_at': now,
        'updated_at': now
    }
    await db.profiles.insert_one(profile)
    
    # Check if admin
    if phone == ADMIN_PHONE:
        await db.user_roles.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'role': 'admin'
        })
    
    # Create subscription record
    await db.user_subscriptions.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'plan_type': 'free',
        'created_at': now,
        'updated_at': now
    })
    
    # Clean up OTP record
    await db.phone_otps.delete_one({'phone': phone})
    
    # Generate token
    token = create_access_token(user_id)
    
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=profile['id'],
            user_id=user_id,
            phone=phone,
            email=email,
            username=username,
            full_name=request.full_name,
            avatar_url=None,
            bio=None,
            dob=None,
            is_disabled=False,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login with credentials"""
    identifier = request.identifier.strip().lower()
    
    # Find profile by phone, email, or username
    profile = await db.profiles.find_one({
        '$or': [
            {'phone': identifier},
            {'email': identifier},
            {'username': identifier}
        ]
    })
    
    if not profile:
        raise HTTPException(status_code=401, detail="User not found")
    
    if profile.get('is_disabled'):
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Get auth record
    auth = await db.auth.find_one({'user_id': profile['user_id']})
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(request.password, auth['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = create_access_token(profile['user_id'])
    
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=profile['id'],
            user_id=profile['user_id'],
            phone=profile['phone'],
            email=profile.get('email'),
            username=profile.get('username'),
            full_name=profile.get('full_name'),
            avatar_url=profile.get('avatar_url'),
            bio=profile.get('bio'),
            dob=profile.get('dob'),
            is_disabled=profile.get('is_disabled', False),
            created_at=profile['created_at']
        )
    )

@api_router.get("/auth/me")
async def get_me(authorization: str = None):
    """Get current user"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    profile = await get_current_user(authorization)
    
    # Check admin role
    role = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    is_admin = role is not None
    
    return {
        'id': profile['id'],
        'user_id': profile['user_id'],
        'phone': profile['phone'],
        'email': profile.get('email'),
        'username': profile.get('username'),
        'full_name': profile.get('full_name'),
        'avatar_url': profile.get('avatar_url'),
        'bio': profile.get('bio'),
        'dob': profile.get('dob'),
        'is_disabled': profile.get('is_disabled', False),
        'is_admin': is_admin,
        'created_at': profile['created_at']
    }

@api_router.post("/auth/reset-password")
async def reset_password(request: PasswordResetRequest):
    """Reset password after OTP verification"""
    phone = request.phone.strip()
    
    # Check if phone OTP was verified
    otp_record = await db.phone_otps.find_one({'phone': phone, 'verified': True})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Phone not verified. Please verify OTP first.")
    
    # Find user
    profile = await db.profiles.find_one({'phone': phone})
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    hashed_password = hash_password(request.new_password)
    await db.auth.update_one(
        {'user_id': profile['user_id']},
        {'$set': {'password_hash': hashed_password}}
    )
    
    # Clean up OTP record
    await db.phone_otps.delete_one({'phone': phone})
    
    return {"message": "Password reset successfully"}

@api_router.post("/auth/logout")
async def logout():
    """Logout (client should discard token)"""
    return {"message": "Logged out successfully"}

# ============== Profile Routes ==============

@api_router.get("/profiles/{identifier}")
async def get_profile(identifier: str, authorization: str = None):
    """Get profile by user_id or username"""
    profile = await db.profiles.find_one({
        '$or': [
            {'user_id': identifier},
            {'username': identifier}
        ]
    })
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get follower/following counts
    followers_count = await db.followers.count_documents({'following_id': profile['user_id']})
    following_count = await db.followers.count_documents({'follower_id': profile['user_id']})
    posts_count = await db.posts.count_documents({'user_id': profile['user_id']})
    
    # Check if current user follows this profile
    is_following = False
    if authorization:
        try:
            current_user = await get_current_user(authorization)
            follow = await db.followers.find_one({
                'follower_id': current_user['user_id'],
                'following_id': profile['user_id']
            })
            is_following = follow is not None
        except:
            pass
    
    return {
        **{k: v for k, v in profile.items() if k != '_id'},
        'followers_count': followers_count,
        'following_count': following_count,
        'posts_count': posts_count,
        'is_following': is_following
    }

@api_router.put("/profiles/me")
async def update_profile(update: ProfileUpdate, authorization: str = None):
    """Update current user's profile"""
    profile = await get_current_user(authorization)
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        update_data['updated_at'] = datetime.utcnow().isoformat()
        await db.profiles.update_one(
            {'user_id': profile['user_id']},
            {'$set': update_data}
        )
    
    updated_profile = await db.profiles.find_one({'user_id': profile['user_id']})
    return {k: v for k, v in updated_profile.items() if k != '_id'}

@api_router.get("/profiles")
async def search_profiles(q: str = Query(None), limit: int = 20):
    """Search profiles"""
    if not q:
        return []
    
    profiles = await db.profiles.find({
        '$or': [
            {'username': {'$regex': q, '$options': 'i'}},
            {'full_name': {'$regex': q, '$options': 'i'}}
        ],
        'is_disabled': {'$ne': True}
    }).limit(limit).to_list(limit)
    
    return [{k: v for k, v in p.items() if k != '_id'} for p in profiles]

@api_router.post("/profiles/check-username")
async def check_username(username: str = Form(...)):
    """Check if username is available"""
    existing = await db.profiles.find_one({'username': username.lower()})
    return {'available': existing is None}

@api_router.post("/profiles/check-email")
async def check_email(email: str = Form(...)):
    """Check if email is available"""
    existing = await db.profiles.find_one({'email': email.lower()})
    return {'available': existing is None}

@api_router.post("/profiles/check-phone")
async def check_phone(phone: str = Form(...)):
    """Check if phone is available"""
    existing = await db.profiles.find_one({'phone': phone})
    return {'available': existing is None}

# ============== Posts Routes ==============

@api_router.get("/posts")
async def get_posts(
    user_id: str = Query(None),
    limit: int = 30,
    offset: int = 0,
    authorization: str = None
):
    """Get posts feed"""
    query = {}
    if user_id:
        query['user_id'] = user_id
    
    posts = await db.posts.find(query).sort('created_at', -1).skip(offset).limit(limit).to_list(limit)
    
    if not posts:
        return []
    
    # Get user profiles with projection
    user_ids = list(set(p['user_id'] for p in posts))
    profiles = await db.profiles.find(
        {'user_id': {'$in': user_ids}},
        {'user_id': 1, 'full_name': 1, 'username': 1, 'avatar_url': 1}
    ).to_list(len(user_ids))
    profiles_map = {p['user_id']: p for p in profiles}
    
    # Get current user for checking likes
    current_user = await get_optional_user(authorization)
    
    # Batch fetch likes and comments counts using aggregation
    post_ids = [p['id'] for p in posts]
    
    likes_pipeline = await db.likes.aggregate([
        {'$match': {'post_id': {'$in': post_ids}}},
        {'$group': {'_id': '$post_id', 'count': {'$sum': 1}}}
    ]).to_list(None)
    likes_map = {item['_id']: item['count'] for item in likes_pipeline}
    
    comments_pipeline = await db.comments.aggregate([
        {'$match': {'post_id': {'$in': post_ids}}},
        {'$group': {'_id': '$post_id', 'count': {'$sum': 1}}}
    ]).to_list(None)
    comments_map = {item['_id']: item['count'] for item in comments_pipeline}
    
    # Batch check user likes and saves
    user_liked_posts = set()
    user_saved_posts = set()
    if current_user:
        user_likes = await db.likes.find(
            {'post_id': {'$in': post_ids}, 'user_id': current_user['user_id']},
            {'post_id': 1}
        ).to_list(len(post_ids))
        user_liked_posts = {l['post_id'] for l in user_likes}
        
        user_saves = await db.saved_posts.find(
            {'post_id': {'$in': post_ids}, 'user_id': current_user['user_id']},
            {'post_id': 1}
        ).to_list(len(post_ids))
        user_saved_posts = {s['post_id'] for s in user_saves}
    
    result = []
    for post in posts:
        profile = profiles_map.get(post['user_id'], {})
        
        result.append({
            **{k: v for k, v in post.items() if k != '_id'},
            'profiles': {
                'full_name': profile.get('full_name'),
                'username': profile.get('username'),
                'avatar_url': profile.get('avatar_url')
            },
            'likes_count': likes_map.get(post['id'], 0),
            'comments_count': comments_map.get(post['id'], 0),
            'is_liked': post['id'] in user_liked_posts,
            'is_saved': post['id'] in user_saved_posts
        })
    
    return result

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, authorization: str = None):
    """Get single post"""
    post = await db.posts.find_one({'id': post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    profile = await db.profiles.find_one({'user_id': post['user_id']})
    likes_count = await db.likes.count_documents({'post_id': post_id})
    comments_count = await db.comments.count_documents({'post_id': post_id})
    
    current_user = await get_optional_user(authorization)
    is_liked = False
    is_saved = False
    if current_user:
        like = await db.likes.find_one({'post_id': post_id, 'user_id': current_user['user_id']})
        is_liked = like is not None
        saved = await db.saved_posts.find_one({'post_id': post_id, 'user_id': current_user['user_id']})
        is_saved = saved is not None
    
    return {
        **{k: v for k, v in post.items() if k != '_id'},
        'profiles': {
            'user_id': profile['user_id'] if profile else None,
            'full_name': profile.get('full_name') if profile else None,
            'username': profile.get('username') if profile else None,
            'avatar_url': profile.get('avatar_url') if profile else None
        },
        'likes_count': likes_count,
        'comments_count': comments_count,
        'is_liked': is_liked,
        'is_saved': is_saved
    }

@api_router.post("/posts")
async def create_post(
    caption: str = Form(None),
    location: str = Form(None),
    media_type: str = Form('image'),
    comments_enabled: bool = Form(True),
    files: List[UploadFile] = File(...),
    authorization: str = None
):
    """Create a new post"""
    profile = await get_current_user(authorization)
    
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    
    # Save files
    image_urls = []
    thumbnail_url = None
    
    for i, file in enumerate(files):
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = UPLOAD_DIR / 'posts' / filename
        
        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        file_url = f"/api/files/posts/{filename}"
        image_urls.append(file_url)
        
        if i == 0:
            thumbnail_url = file_url
    
    post_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    post = {
        'id': post_id,
        'user_id': profile['user_id'],
        'image_url': image_urls[0],
        'image_urls': image_urls,
        'thumbnail_url': thumbnail_url,
        'caption': caption,
        'location': location,
        'media_type': media_type,
        'comments_enabled': comments_enabled,
        'background_audio_url': None,
        'created_at': now,
        'updated_at': now
    }
    
    await db.posts.insert_one(post)
    
    return {k: v for k, v in post.items() if k != '_id'}

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, authorization: str = None):
    """Delete a post"""
    profile = await get_current_user(authorization)
    
    post = await db.posts.find_one({'id': post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check ownership or admin
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if post['user_id'] != profile['user_id'] and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete associated data
    await db.likes.delete_many({'post_id': post_id})
    await db.comments.delete_many({'post_id': post_id})
    await db.saved_posts.delete_many({'post_id': post_id})
    await db.posts.delete_one({'id': post_id})
    
    return {"message": "Post deleted"}

# ============== Likes Routes ==============

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, authorization: str = None):
    """Toggle like on a post"""
    profile = await get_current_user(authorization)
    
    post = await db.posts.find_one({'id': post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.likes.find_one({
        'post_id': post_id,
        'user_id': profile['user_id']
    })
    
    if existing:
        await db.likes.delete_one({'id': existing['id']})
        liked = False
    else:
        await db.likes.insert_one({
            'id': str(uuid.uuid4()),
            'post_id': post_id,
            'user_id': profile['user_id'],
            'created_at': datetime.utcnow().isoformat()
        })
        liked = True
    
    likes_count = await db.likes.count_documents({'post_id': post_id})
    return {'liked': liked, 'likes_count': likes_count}

@api_router.get("/posts/{post_id}/likes")
async def get_post_likes(post_id: str, limit: int = 50):
    """Get users who liked a post"""
    likes = await db.likes.find({'post_id': post_id}).sort('created_at', -1).limit(limit).to_list(limit)
    
    user_ids = [l['user_id'] for l in likes]
    profiles = await db.profiles.find({'user_id': {'$in': user_ids}}).to_list(len(user_ids))
    
    return [{
        'user_id': p['user_id'],
        'username': p.get('username'),
        'full_name': p.get('full_name'),
        'avatar_url': p.get('avatar_url')
    } for p in profiles]

# ============== Comments Routes ==============

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, limit: int = 50):
    """Get comments for a post"""
    comments = await db.comments.find({'post_id': post_id}).sort('created_at', 1).limit(limit).to_list(limit)
    
    user_ids = list(set(c['user_id'] for c in comments))
    profiles = await db.profiles.find({'user_id': {'$in': user_ids}}).to_list(len(user_ids))
    profiles_map = {p['user_id']: p for p in profiles}
    
    return [{
        **{k: v for k, v in c.items() if k != '_id'},
        'profiles': {
            'username': profiles_map.get(c['user_id'], {}).get('username'),
            'full_name': profiles_map.get(c['user_id'], {}).get('full_name'),
            'avatar_url': profiles_map.get(c['user_id'], {}).get('avatar_url')
        }
    } for c in comments]

@api_router.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, comment: CommentCreate, authorization: str = None):
    """Add comment to a post"""
    profile = await get_current_user(authorization)
    
    post = await db.posts.find_one({'id': post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not post.get('comments_enabled', True):
        raise HTTPException(status_code=403, detail="Comments are disabled for this post")
    
    comment_doc = {
        'id': str(uuid.uuid4()),
        'post_id': post_id,
        'user_id': profile['user_id'],
        'content': comment.content,
        'created_at': datetime.utcnow().isoformat()
    }
    
    await db.comments.insert_one(comment_doc)
    
    return {
        **{k: v for k, v in comment_doc.items() if k != '_id'},
        'profiles': {
            'username': profile.get('username'),
            'full_name': profile.get('full_name'),
            'avatar_url': profile.get('avatar_url')
        }
    }

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, authorization: str = None):
    """Delete a comment"""
    profile = await get_current_user(authorization)
    
    comment = await db.comments.find_one({'id': comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check ownership or post owner or admin
    post = await db.posts.find_one({'id': comment['post_id']})
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    
    if (comment['user_id'] != profile['user_id'] and 
        post['user_id'] != profile['user_id'] and 
        not is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.comments.delete_one({'id': comment_id})
    return {"message": "Comment deleted"}

# ============== Saved Posts Routes ==============

@api_router.post("/posts/{post_id}/save")
async def toggle_save(post_id: str, authorization: str = None):
    """Toggle save on a post"""
    profile = await get_current_user(authorization)
    
    post = await db.posts.find_one({'id': post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.saved_posts.find_one({
        'post_id': post_id,
        'user_id': profile['user_id']
    })
    
    if existing:
        await db.saved_posts.delete_one({'id': existing['id']})
        saved = False
    else:
        await db.saved_posts.insert_one({
            'id': str(uuid.uuid4()),
            'post_id': post_id,
            'user_id': profile['user_id'],
            'created_at': datetime.utcnow().isoformat()
        })
        saved = True
    
    return {'saved': saved}

@api_router.get("/saved")
async def get_saved_posts(authorization: str = None, limit: int = 30, offset: int = 0):
    """Get saved posts for current user"""
    profile = await get_current_user(authorization)
    
    saved = await db.saved_posts.find({'user_id': profile['user_id']}).sort('created_at', -1).skip(offset).limit(limit).to_list(limit)
    
    post_ids = [s['post_id'] for s in saved]
    posts = await db.posts.find({'id': {'$in': post_ids}}).to_list(len(post_ids))
    
    # Get profiles
    user_ids = list(set(p['user_id'] for p in posts))
    profiles = await db.profiles.find({'user_id': {'$in': user_ids}}).to_list(len(user_ids))
    profiles_map = {p['user_id']: p for p in profiles}
    
    result = []
    for post in posts:
        prof = profiles_map.get(post['user_id'], {})
        result.append({
            **{k: v for k, v in post.items() if k != '_id'},
            'profiles': {
                'full_name': prof.get('full_name'),
                'username': prof.get('username'),
                'avatar_url': prof.get('avatar_url')
            }
        })
    
    return result

# ============== Follow Routes ==============

@api_router.post("/follow/{user_id}")
async def toggle_follow(user_id: str, authorization: str = None):
    """Toggle follow on a user"""
    profile = await get_current_user(authorization)
    
    if user_id == profile['user_id']:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target = await db.profiles.find_one({'user_id': user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.followers.find_one({
        'follower_id': profile['user_id'],
        'following_id': user_id
    })
    
    if existing:
        await db.followers.delete_one({'id': existing['id']})
        following = False
    else:
        await db.followers.insert_one({
            'id': str(uuid.uuid4()),
            'follower_id': profile['user_id'],
            'following_id': user_id,
            'created_at': datetime.utcnow().isoformat()
        })
        following = True
    
    followers_count = await db.followers.count_documents({'following_id': user_id})
    return {'following': following, 'followers_count': followers_count}

@api_router.get("/followers/{user_id}")
async def get_followers(user_id: str, limit: int = 50):
    """Get followers of a user"""
    followers = await db.followers.find({'following_id': user_id}).sort('created_at', -1).limit(limit).to_list(limit)
    
    follower_ids = [f['follower_id'] for f in followers]
    profiles = await db.profiles.find({'user_id': {'$in': follower_ids}}).to_list(len(follower_ids))
    
    return [{
        'user_id': p['user_id'],
        'username': p.get('username'),
        'full_name': p.get('full_name'),
        'avatar_url': p.get('avatar_url')
    } for p in profiles]

@api_router.get("/following/{user_id}")
async def get_following(user_id: str, limit: int = 50):
    """Get users that a user is following"""
    following = await db.followers.find({'follower_id': user_id}).sort('created_at', -1).limit(limit).to_list(limit)
    
    following_ids = [f['following_id'] for f in following]
    profiles = await db.profiles.find({'user_id': {'$in': following_ids}}).to_list(len(following_ids))
    
    return [{
        'user_id': p['user_id'],
        'username': p.get('username'),
        'full_name': p.get('full_name'),
        'avatar_url': p.get('avatar_url')
    } for p in profiles]

# ============== Stories Routes ==============

@api_router.get("/stories")
async def get_stories(authorization: str = None):
    """Get active stories"""
    now = datetime.utcnow().isoformat()
    
    # Get all non-expired stories
    stories = await db.stories.find({
        'expires_at': {'$gt': now}
    }).sort('created_at', -1).to_list(100)
    
    # Group by user
    user_ids = list(set(s['user_id'] for s in stories))
    profiles = await db.profiles.find({'user_id': {'$in': user_ids}}).to_list(len(user_ids))
    profiles_map = {p['user_id']: p for p in profiles}
    
    # Get current user for view status
    current_user = await get_optional_user(authorization)
    
    result = []
    for story in stories:
        prof = profiles_map.get(story['user_id'], {})
        
        # Check if viewed by current user
        is_viewed = False
        if current_user:
            view = await db.story_views.find_one({
                'story_id': story['id'],
                'viewer_id': current_user['user_id']
            })
            is_viewed = view is not None
        
        result.append({
            **{k: v for k, v in story.items() if k != '_id'},
            'profiles': {
                'user_id': prof.get('user_id'),
                'username': prof.get('username'),
                'full_name': prof.get('full_name'),
                'avatar_url': prof.get('avatar_url')
            },
            'is_viewed': is_viewed
        })
    
    return result

@api_router.post("/stories")
async def create_story(
    media_type: str = Form('image'),
    duration: int = Form(5),
    file: UploadFile = File(...),
    authorization: str = None
):
    """Create a new story"""
    profile = await get_current_user(authorization)
    
    # Save file
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / 'stories' / filename
    
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    media_url = f"/api/files/stories/{filename}"
    
    now = datetime.utcnow()
    story = {
        'id': str(uuid.uuid4()),
        'user_id': profile['user_id'],
        'media_url': media_url,
        'media_type': media_type,
        'duration': duration,
        'background_audio_url': None,
        'created_at': now.isoformat(),
        'expires_at': (now + timedelta(hours=24)).isoformat()
    }
    
    await db.stories.insert_one(story)
    
    return {k: v for k, v in story.items() if k != '_id'}

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, authorization: str = None):
    """Delete a story"""
    profile = await get_current_user(authorization)
    
    story = await db.stories.find_one({'id': story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if story['user_id'] != profile['user_id'] and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.story_views.delete_many({'story_id': story_id})
    await db.story_likes.delete_many({'story_id': story_id})
    await db.story_comments.delete_many({'story_id': story_id})
    await db.stories.delete_one({'id': story_id})
    
    return {"message": "Story deleted"}

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, authorization: str = None):
    """Mark story as viewed"""
    profile = await get_current_user(authorization)
    
    story = await db.stories.find_one({'id': story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    existing = await db.story_views.find_one({
        'story_id': story_id,
        'viewer_id': profile['user_id']
    })
    
    if not existing:
        await db.story_views.insert_one({
            'id': str(uuid.uuid4()),
            'story_id': story_id,
            'viewer_id': profile['user_id'],
            'viewed_at': datetime.utcnow().isoformat()
        })
    
    return {"viewed": True}

@api_router.post("/stories/{story_id}/like")
async def toggle_story_like(story_id: str, authorization: str = None):
    """Toggle like on a story"""
    profile = await get_current_user(authorization)
    
    story = await db.stories.find_one({'id': story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    existing = await db.story_likes.find_one({
        'story_id': story_id,
        'user_id': profile['user_id']
    })
    
    if existing:
        await db.story_likes.delete_one({'id': existing['id']})
        liked = False
    else:
        await db.story_likes.insert_one({
            'id': str(uuid.uuid4()),
            'story_id': story_id,
            'user_id': profile['user_id'],
            'created_at': datetime.utcnow().isoformat()
        })
        liked = True
    
    return {'liked': liked}

# ============== Messages Routes ==============

@api_router.get("/conversations")
async def get_conversations(authorization: str = None):
    """Get all conversations for current user"""
    profile = await get_current_user(authorization)
    
    convos = await db.conversations.find({
        '$or': [
            {'participant_1': profile['user_id']},
            {'participant_2': profile['user_id']}
        ]
    }).sort('last_message_at', -1).to_list(100)
    
    result = []
    for convo in convos:
        # Get other participant
        other_id = convo['participant_2'] if convo['participant_1'] == profile['user_id'] else convo['participant_1']
        other_profile = await db.profiles.find_one({'user_id': other_id})
        
        # Get last message
        last_message = await db.messages.find_one(
            {'conversation_id': convo['id']},
            sort=[('created_at', -1)]
        )
        
        # Count unread
        unread_count = await db.messages.count_documents({
            'conversation_id': convo['id'],
            'sender_id': {'$ne': profile['user_id']},
            'read_at': None
        })
        
        result.append({
            **{k: v for k, v in convo.items() if k != '_id'},
            'other_user': {
                'user_id': other_id,
                'username': other_profile.get('username') if other_profile else None,
                'full_name': other_profile.get('full_name') if other_profile else None,
                'avatar_url': other_profile.get('avatar_url') if other_profile else None
            },
            'last_message': {k: v for k, v in last_message.items() if k != '_id'} if last_message else None,
            'unread_count': unread_count
        })
    
    return result

@api_router.get("/conversations/{user_id}")
async def get_or_create_conversation(user_id: str, authorization: str = None):
    """Get or create conversation with a user"""
    profile = await get_current_user(authorization)
    
    if user_id == profile['user_id']:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    
    # Check if target user exists
    target = await db.profiles.find_one({'user_id': user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find existing conversation
    convo = await db.conversations.find_one({
        '$or': [
            {'participant_1': profile['user_id'], 'participant_2': user_id},
            {'participant_1': user_id, 'participant_2': profile['user_id']}
        ]
    })
    
    if not convo:
        # Create new conversation
        convo = {
            'id': str(uuid.uuid4()),
            'participant_1': profile['user_id'],
            'participant_2': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'last_message_at': datetime.utcnow().isoformat()
        }
        await db.conversations.insert_one(convo)
    
    return {
        **{k: v for k, v in convo.items() if k != '_id'},
        'other_user': {
            'user_id': user_id,
            'username': target.get('username'),
            'full_name': target.get('full_name'),
            'avatar_url': target.get('avatar_url')
        }
    }

@api_router.get("/messages/{conversation_id}")
async def get_messages(conversation_id: str, limit: int = 50, before: str = None, authorization: str = None):
    """Get messages in a conversation"""
    profile = await get_current_user(authorization)
    
    # Verify user is participant
    convo = await db.conversations.find_one({'id': conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if profile['user_id'] not in [convo['participant_1'], convo['participant_2']]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {'conversation_id': conversation_id}
    if before:
        query['created_at'] = {'$lt': before}
    
    messages = await db.messages.find(query).sort('created_at', -1).limit(limit).to_list(limit)
    
    # Get sender profiles
    sender_ids = list(set(m['sender_id'] for m in messages))
    profiles = await db.profiles.find({'user_id': {'$in': sender_ids}}).to_list(len(sender_ids))
    profiles_map = {p['user_id']: p for p in profiles}
    
    # Mark as read
    await db.messages.update_many(
        {
            'conversation_id': conversation_id,
            'sender_id': {'$ne': profile['user_id']},
            'read_at': None
        },
        {'$set': {'read_at': datetime.utcnow().isoformat()}}
    )
    
    return [{
        **{k: v for k, v in m.items() if k != '_id'},
        'sender_profile': {
            'username': profiles_map.get(m['sender_id'], {}).get('username'),
            'full_name': profiles_map.get(m['sender_id'], {}).get('full_name'),
            'avatar_url': profiles_map.get(m['sender_id'], {}).get('avatar_url')
        }
    } for m in reversed(messages)]

@api_router.post("/messages/{conversation_id}")
async def send_message(conversation_id: str, message: MessageCreate, authorization: str = None):
    """Send a message"""
    profile = await get_current_user(authorization)
    
    convo = await db.conversations.find_one({'id': conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if profile['user_id'] not in [convo['participant_1'], convo['participant_2']]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.utcnow().isoformat()
    
    msg = {
        'id': str(uuid.uuid4()),
        'conversation_id': conversation_id,
        'sender_id': profile['user_id'],
        'content': message.content,
        'media_type': message.media_type,
        'media_url': message.media_url,
        'shared_post_id': message.shared_post_id,
        'read_at': None,
        'created_at': now
    }
    
    await db.messages.insert_one(msg)
    
    # Update conversation
    await db.conversations.update_one(
        {'id': conversation_id},
        {'$set': {'last_message_at': now}}
    )
    
    return {
        **{k: v for k, v in msg.items() if k != '_id'},
        'sender_profile': {
            'username': profile.get('username'),
            'full_name': profile.get('full_name'),
            'avatar_url': profile.get('avatar_url')
        }
    }

# ============== File Upload Routes ==============

@api_router.post("/upload/{folder}")
async def upload_file(folder: str, file: UploadFile = File(...), authorization: str = None):
    """Upload a file"""
    profile = await get_current_user(authorization)
    
    if folder not in ['avatars', 'posts', 'stories', 'messages']:
        raise HTTPException(status_code=400, detail="Invalid folder")
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / folder / filename
    
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    file_url = f"/api/files/{folder}/{filename}"
    
    # If avatar, update profile
    if folder == 'avatars':
        await db.profiles.update_one(
            {'user_id': profile['user_id']},
            {'$set': {'avatar_url': file_url, 'updated_at': datetime.utcnow().isoformat()}}
        )
    
    return {'url': file_url}

@api_router.get("/files/{folder}/{filename}")
async def get_file(folder: str, filename: str):
    """Serve uploaded file"""
    if folder not in ['avatars', 'posts', 'stories', 'messages']:
        raise HTTPException(status_code=400, detail="Invalid folder")
    
    filepath = UPLOAD_DIR / folder / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(filepath)

# ============== Notifications Routes ==============

@api_router.get("/notifications")
async def get_notifications(authorization: str = None, limit: int = 50):
    """Get notifications for current user"""
    profile = await get_current_user(authorization)
    
    notifications = []
    
    # New followers - batch fetch profiles
    followers = await db.followers.find({'following_id': profile['user_id']}).sort('created_at', -1).limit(20).to_list(20)
    if followers:
        follower_ids = [f['follower_id'] for f in followers]
        follower_profiles = await db.profiles.find(
            {'user_id': {'$in': follower_ids}},
            {'user_id': 1, 'username': 1, 'full_name': 1, 'avatar_url': 1}
        ).to_list(len(follower_ids))
        follower_map = {p['user_id']: p for p in follower_profiles}
        
        for f in followers:
            fp = follower_map.get(f['follower_id'])
            if fp:
                notifications.append({
                    'id': f['id'],
                    'type': 'follow',
                    'user_id': f['follower_id'],
                    'username': fp.get('username'),
                    'full_name': fp.get('full_name'),
                    'avatar_url': fp.get('avatar_url'),
                    'message': 'started following you',
                    'created_at': f['created_at']
                })
    
    # Get user's post IDs with projection
    user_posts = await db.posts.find(
        {'user_id': profile['user_id']},
        {'id': 1}
    ).to_list(100)
    post_ids = [p['id'] for p in user_posts]
    
    if post_ids:
        # Likes on user's posts - batch fetch profiles
        likes = await db.likes.find(
            {'post_id': {'$in': post_ids}, 'user_id': {'$ne': profile['user_id']}}
        ).sort('created_at', -1).limit(20).to_list(20)
        
        if likes:
            liker_ids = list(set(l['user_id'] for l in likes))
            liker_profiles = await db.profiles.find(
                {'user_id': {'$in': liker_ids}},
                {'user_id': 1, 'username': 1, 'full_name': 1, 'avatar_url': 1}
            ).to_list(len(liker_ids))
            liker_map = {p['user_id']: p for p in liker_profiles}
            
            for l in likes:
                lp = liker_map.get(l['user_id'])
                if lp:
                    notifications.append({
                        'id': l['id'],
                        'type': 'like',
                        'user_id': l['user_id'],
                        'username': lp.get('username'),
                        'full_name': lp.get('full_name'),
                        'avatar_url': lp.get('avatar_url'),
                        'post_id': l['post_id'],
                        'message': 'liked your post',
                        'created_at': l['created_at']
                    })
        
        # Comments on user's posts - batch fetch profiles
        comments = await db.comments.find(
            {'post_id': {'$in': post_ids}, 'user_id': {'$ne': profile['user_id']}}
        ).sort('created_at', -1).limit(20).to_list(20)
        
        if comments:
            commenter_ids = list(set(c['user_id'] for c in comments))
            commenter_profiles = await db.profiles.find(
                {'user_id': {'$in': commenter_ids}},
                {'user_id': 1, 'username': 1, 'full_name': 1, 'avatar_url': 1}
            ).to_list(len(commenter_ids))
            commenter_map = {p['user_id']: p for p in commenter_profiles}
            
            for c in comments:
                cp = commenter_map.get(c['user_id'])
                if cp:
                    notifications.append({
                        'id': c['id'],
                        'type': 'comment',
                        'user_id': c['user_id'],
                        'username': cp.get('username'),
                        'full_name': cp.get('full_name'),
                        'avatar_url': cp.get('avatar_url'),
                        'post_id': c['post_id'],
                        'message': f'commented: {c["content"][:50]}...' if len(c['content']) > 50 else f'commented: {c["content"]}',
                        'created_at': c['created_at']
                    })
    
    # Sort by date
    notifications.sort(key=lambda x: x['created_at'], reverse=True)
    return notifications[:limit]

# ============== Contact Queries Routes ==============

@api_router.post("/contact")
async def create_contact_query(query: ContactQueryCreate, authorization: str = None):
    """Create a contact query"""
    profile = await get_current_user(authorization)
    
    contact = {
        'id': str(uuid.uuid4()),
        'user_id': profile['user_id'],
        'full_name': profile.get('full_name'),
        'username': profile.get('username'),
        'email': profile.get('email'),
        'phone': profile.get('phone'),
        'query': query.query,
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat()
    }
    
    await db.contact_queries.insert_one(contact)
    return {k: v for k, v in contact.items() if k != '_id'}

# ============== Admin Routes ==============

@api_router.get("/admin/users")
async def admin_get_users(authorization: str = None, limit: int = 50, offset: int = 0):
    """Admin: Get all users"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.profiles.find().sort('created_at', -1).skip(offset).limit(limit).to_list(limit)
    return [{k: v for k, v in u.items() if k != '_id'} for u in users]

@api_router.post("/admin/users/{user_id}/disable")
async def admin_disable_user(user_id: str, authorization: str = None):
    """Admin: Disable a user"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.profiles.update_one(
        {'user_id': user_id},
        {'$set': {'is_disabled': True}}
    )
    return {"message": "User disabled"}

@api_router.post("/admin/users/{user_id}/enable")
async def admin_enable_user(user_id: str, authorization: str = None):
    """Admin: Enable a user"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.profiles.update_one(
        {'user_id': user_id},
        {'$set': {'is_disabled': False}}
    )
    return {"message": "User enabled"}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, authorization: str = None):
    """Admin: Delete a user"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Delete all user data
    await db.auth.delete_many({'user_id': user_id})
    await db.profiles.delete_many({'user_id': user_id})
    await db.posts.delete_many({'user_id': user_id})
    await db.comments.delete_many({'user_id': user_id})
    await db.likes.delete_many({'user_id': user_id})
    await db.saved_posts.delete_many({'user_id': user_id})
    await db.stories.delete_many({'user_id': user_id})
    await db.story_views.delete_many({'viewer_id': user_id})
    await db.story_likes.delete_many({'user_id': user_id})
    await db.followers.delete_many({'$or': [{'follower_id': user_id}, {'following_id': user_id}]})
    await db.conversations.delete_many({'$or': [{'participant_1': user_id}, {'participant_2': user_id}]})
    await db.messages.delete_many({'sender_id': user_id})
    await db.user_roles.delete_many({'user_id': user_id})
    await db.user_subscriptions.delete_many({'user_id': user_id})
    await db.contact_queries.delete_many({'user_id': user_id})
    
    return {"message": "User deleted"}

@api_router.get("/admin/contacts")
async def admin_get_contacts(authorization: str = None, status: str = None, limit: int = 50):
    """Admin: Get contact queries"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query['status'] = status
    
    contacts = await db.contact_queries.find(query).sort('created_at', -1).limit(limit).to_list(limit)
    return [{k: v for k, v in c.items() if k != '_id'} for c in contacts]

@api_router.put("/admin/contacts/{contact_id}")
async def admin_update_contact(contact_id: str, status: str = Form(...), authorization: str = None):
    """Admin: Update contact query status"""
    profile = await get_current_user(authorization)
    
    is_admin = await db.user_roles.find_one({'user_id': profile['user_id'], 'role': 'admin'})
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.contact_queries.update_one(
        {'id': contact_id},
        {'$set': {'status': status}}
    )
    return {"message": "Contact updated"}

# ============== Subscription Routes ==============

@api_router.get("/subscription")
async def get_subscription(authorization: str = None):
    """Get current user's subscription"""
    profile = await get_current_user(authorization)
    
    sub = await db.user_subscriptions.find_one({'user_id': profile['user_id']})
    if not sub:
        sub = {
            'id': str(uuid.uuid4()),
            'user_id': profile['user_id'],
            'plan_type': 'free',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        await db.user_subscriptions.insert_one(sub)
    
    return {k: v for k, v in sub.items() if k != '_id'}

# ============== Category Routes ==============

@api_router.get("/categories")
async def get_categories():
    """Get all category settings"""
    categories = await db.category_settings.find().to_list(100)
    return [{k: v for k, v in c.items() if k != '_id'} for c in categories]

@api_router.get("/categories/{category_id}/videos")
async def get_category_videos(category_id: str, limit: int = 20):
    """Get videos for a category"""
    videos = await db.category_videos.find({'category_id': category_id}).sort('created_at', -1).limit(limit).to_list(limit)
    return [{k: v for k, v in v.items() if k != '_id'} for v in videos]

# ============== Health Check ==============

@api_router.get("/")
async def root():
    return {"message": "Agharia Social Hub API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
