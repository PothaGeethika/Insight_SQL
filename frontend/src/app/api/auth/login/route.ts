import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/userDb";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

async function signJwt(payload: object): Promise<string> {
  const jwt = (await import("jsonwebtoken")).default;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" } as any);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(password, hash);
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signJwt({ id: user.id, email: user.email, name: user.name });

    const response = NextResponse.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
