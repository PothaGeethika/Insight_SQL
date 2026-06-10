import { NextRequest, NextResponse } from "next/server";

const JSON_SERVER_URL = process.env.JSON_SERVER_URL || "http://localhost:3001";

// Dynamic import for bcryptjs
async function hashPassword(password: string): Promise<string> {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

// POST: Check if email exists (step 1 of password reset)
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const res = await fetch(
      `${JSON_SERVER_URL}/users?email=${encodeURIComponent(email)}`
    );
    const users = await res.json();

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 404 }
      );
    }

    // In a real app we'd send a reset email. Here we simply confirm the account exists.
    return NextResponse.json({
      message: "Account found. You may now reset your password.",
      userId: users[0].id,
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Actually reset the password (step 2)
export async function PUT(req: NextRequest) {
  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find the user
    const res = await fetch(
      `${JSON_SERVER_URL}/users?email=${encodeURIComponent(email)}`
    );
    const users = await res.json();

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 404 }
      );
    }

    const user = users[0];

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user's password in json-server
    const updateRes = await fetch(`${JSON_SERVER_URL}/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: hashedPassword }),
    });

    if (!updateRes.ok) {
      throw new Error("Failed to update password");
    }

    return NextResponse.json({
      message: "Password has been reset successfully",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
