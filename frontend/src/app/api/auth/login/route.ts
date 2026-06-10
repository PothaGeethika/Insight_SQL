import { NextRequest, NextResponse } from "next/server";

const JSON_SERVER_URL = process.env.JSON_SERVER_URL || "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET || "insightsql_jwt_secret_key_2025_secure";

// Dynamic import for jsonwebtoken (Node-only)
async function signJwt(payload: object, expiresIn: string = "7d"): Promise<string> {
  const jwt = (await import("jsonwebtoken")).default;
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn } as any);
}

async function verifyJwt(token: string): Promise<any> {
  const jwt = (await import("jsonwebtoken")).default;
  return jwt.verify(token, JWT_SECRET);
}

// Dynamic import for bcryptjs
async function hashPassword(password: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(password, hash);
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Fetch user from json-server
    const res = await fetch(
      `${JSON_SERVER_URL}/users?email=${encodeURIComponent(email)}`
    );
    const users = await res.json();

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = users[0];

    // Compare password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Sign JWT
    const token = await signJwt({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Set httpOnly cookie
    const response = NextResponse.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
