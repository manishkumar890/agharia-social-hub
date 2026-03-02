// API Service - Replaces Supabase client for all backend communication
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

// Token storage
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = (): any | null => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const setStoredUser = (user: any): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// HTTP client with auth
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  includeAuth: boolean = true
): Promise<any> => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }

  return response.json();
};

// ============== Auth API ==============

export const authApi = {
  sendOtp: async (phone: string) => {
    return apiRequest('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }, false);
  },

  verifyOtp: async (phone: string, otp: string, mode?: string) => {
    return apiRequest('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, mode }),
    }, false);
  },

  register: async (data: {
    phone: string;
    email: string;
    username: string;
    password: string;
    full_name: string;
  }) => {
    const result = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }, false);
    
    if (result.access_token) {
      setToken(result.access_token);
      setStoredUser(result.user);
    }
    return result;
  },

  login: async (identifier: string, password: string) => {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }, false);
    
    if (result.access_token) {
      setToken(result.access_token);
      setStoredUser(result.user);
    }
    return result;
  },

  logout: async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      removeToken();
    }
  },

  getMe: async () => {
    return apiRequest('/api/auth/me');
  },

  resetPassword: async (phone: string, newPassword: string) => {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ phone, new_password: newPassword }),
    }, false);
  },

  isAuthenticated: () => {
    return !!getToken();
  },
};

// ============== Profile API ==============

export const profileApi = {
  getProfile: async (identifier: string) => {
    return apiRequest(`/api/profiles/${identifier}`);
  },

  updateProfile: async (data: {
    full_name?: string;
    bio?: string;
    email?: string;
    dob?: string;
    avatar_url?: string;
  }) => {
    return apiRequest('/api/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  searchProfiles: async (query: string, limit: number = 20) => {
    return apiRequest(`/api/profiles?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  checkUsername: async (username: string) => {
    const formData = new FormData();
    formData.append('username', username);
    return apiRequest('/api/profiles/check-username', {
      method: 'POST',
      body: formData,
    });
  },

  checkEmail: async (email: string) => {
    const formData = new FormData();
    formData.append('email', email);
    return apiRequest('/api/profiles/check-email', {
      method: 'POST',
      body: formData,
    });
  },

  checkPhone: async (phone: string) => {
    const formData = new FormData();
    formData.append('phone', phone);
    return apiRequest('/api/profiles/check-phone', {
      method: 'POST',
      body: formData,
    });
  },
};

// ============== Posts API ==============

export const postsApi = {
  getPosts: async (options: { userId?: string; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.userId) params.append('user_id', options.userId);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    
    const query = params.toString();
    return apiRequest(`/api/posts${query ? `?${query}` : ''}`);
  },

  getPost: async (postId: string) => {
    return apiRequest(`/api/posts/${postId}`);
  },

  createPost: async (data: {
    caption?: string;
    location?: string;
    media_type?: string;
    comments_enabled?: boolean;
    files: File[];
  }) => {
    const formData = new FormData();
    if (data.caption) formData.append('caption', data.caption);
    if (data.location) formData.append('location', data.location);
    formData.append('media_type', data.media_type || 'image');
    formData.append('comments_enabled', String(data.comments_enabled ?? true));
    
    data.files.forEach((file) => {
      formData.append('files', file);
    });
    
    return apiRequest('/api/posts', {
      method: 'POST',
      body: formData,
    });
  },

  deletePost: async (postId: string) => {
    return apiRequest(`/api/posts/${postId}`, { method: 'DELETE' });
  },

  toggleLike: async (postId: string) => {
    return apiRequest(`/api/posts/${postId}/like`, { method: 'POST' });
  },

  getLikes: async (postId: string) => {
    return apiRequest(`/api/posts/${postId}/likes`);
  },

  toggleSave: async (postId: string) => {
    return apiRequest(`/api/posts/${postId}/save`, { method: 'POST' });
  },
};

// ============== Comments API ==============

export const commentsApi = {
  getComments: async (postId: string, limit: number = 50) => {
    return apiRequest(`/api/posts/${postId}/comments?limit=${limit}`);
  },

  createComment: async (postId: string, content: string) => {
    return apiRequest(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  deleteComment: async (commentId: string) => {
    return apiRequest(`/api/comments/${commentId}`, { method: 'DELETE' });
  },
};

// ============== Saved Posts API ==============

export const savedApi = {
  getSavedPosts: async (limit: number = 30, offset: number = 0) => {
    return apiRequest(`/api/saved?limit=${limit}&offset=${offset}`);
  },
};

// ============== Follow API ==============

export const followApi = {
  toggleFollow: async (userId: string) => {
    return apiRequest(`/api/follow/${userId}`, { method: 'POST' });
  },

  getFollowers: async (userId: string, limit: number = 50) => {
    return apiRequest(`/api/followers/${userId}?limit=${limit}`);
  },

  getFollowing: async (userId: string, limit: number = 50) => {
    return apiRequest(`/api/following/${userId}?limit=${limit}`);
  },
};

// ============== Stories API ==============

export const storiesApi = {
  getStories: async () => {
    return apiRequest('/api/stories');
  },

  createStory: async (file: File, mediaType: string = 'image', duration: number = 5) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    formData.append('duration', duration.toString());
    
    return apiRequest('/api/stories', {
      method: 'POST',
      body: formData,
    });
  },

  deleteStory: async (storyId: string) => {
    return apiRequest(`/api/stories/${storyId}`, { method: 'DELETE' });
  },

  viewStory: async (storyId: string) => {
    return apiRequest(`/api/stories/${storyId}/view`, { method: 'POST' });
  },

  toggleStoryLike: async (storyId: string) => {
    return apiRequest(`/api/stories/${storyId}/like`, { method: 'POST' });
  },
};

// ============== Messages API ==============

export const messagesApi = {
  getConversations: async () => {
    return apiRequest('/api/conversations');
  },

  getOrCreateConversation: async (userId: string) => {
    return apiRequest(`/api/conversations/${userId}`);
  },

  getMessages: async (conversationId: string, limit: number = 50, before?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);
    return apiRequest(`/api/messages/${conversationId}?${params.toString()}`);
  },

  sendMessage: async (conversationId: string, data: {
    content: string;
    media_type?: string;
    media_url?: string;
    shared_post_id?: string;
  }) => {
    return apiRequest(`/api/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============== Notifications API ==============

export const notificationsApi = {
  getNotifications: async (limit: number = 50) => {
    return apiRequest(`/api/notifications?limit=${limit}`);
  },
};

// ============== Upload API ==============

export const uploadApi = {
  uploadFile: async (folder: 'avatars' | 'posts' | 'stories' | 'messages', file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest(`/api/upload/${folder}`, {
      method: 'POST',
      body: formData,
    });
  },

  getFileUrl: (path: string) => {
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
  },
};

// ============== Contact API ==============

export const contactApi = {
  createQuery: async (query: string) => {
    return apiRequest('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },
};

// ============== Admin API ==============

export const adminApi = {
  getUsers: async (limit: number = 50, offset: number = 0) => {
    return apiRequest(`/api/admin/users?limit=${limit}&offset=${offset}`);
  },

  disableUser: async (userId: string) => {
    return apiRequest(`/api/admin/users/${userId}/disable`, { method: 'POST' });
  },

  enableUser: async (userId: string) => {
    return apiRequest(`/api/admin/users/${userId}/enable`, { method: 'POST' });
  },

  deleteUser: async (userId: string) => {
    return apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
  },

  getContacts: async (status?: string, limit: number = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (status) params.append('status', status);
    return apiRequest(`/api/admin/contacts?${params.toString()}`);
  },

  updateContact: async (contactId: string, status: string) => {
    const formData = new FormData();
    formData.append('status', status);
    return apiRequest(`/api/admin/contacts/${contactId}`, {
      method: 'PUT',
      body: formData,
    });
  },
};

// ============== Subscription API ==============

export const subscriptionApi = {
  getSubscription: async () => {
    return apiRequest('/api/subscription');
  },
};

// ============== Categories API ==============

export const categoriesApi = {
  getCategories: async () => {
    return apiRequest('/api/categories');
  },

  getCategoryVideos: async (categoryId: string, limit: number = 20) => {
    return apiRequest(`/api/categories/${categoryId}/videos?limit=${limit}`);
  },
};

// Default export with all APIs
const api = {
  auth: authApi,
  profile: profileApi,
  posts: postsApi,
  comments: commentsApi,
  saved: savedApi,
  follow: followApi,
  stories: storiesApi,
  messages: messagesApi,
  notifications: notificationsApi,
  upload: uploadApi,
  contact: contactApi,
  admin: adminApi,
  subscription: subscriptionApi,
  categories: categoriesApi,
};

export default api;
