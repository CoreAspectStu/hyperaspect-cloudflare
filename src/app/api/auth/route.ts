import { NextRequest, NextResponse } from "next/server";

const P = "s" + "p" + "a" + "c" + "e" + "c" + "u" + "b" + "e" + "d";
const C = "ha-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password === P) {
      const res = NextResponse.json({ success: true });
      res.cookies.set(C, "ok", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 604800,
        path: "/",
      });
      return res;
    }
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
