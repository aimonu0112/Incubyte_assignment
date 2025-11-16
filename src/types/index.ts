export interface Sweet {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  description: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
  };
  isAdmin?: boolean;
}

export interface Transaction {
  id: string;
  sweet_id: string;
  user_id: string;
  transaction_type: 'purchase' | 'restock';
  quantity: number;
  created_at: string;
}
