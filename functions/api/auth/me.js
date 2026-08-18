// Middleware sudah memvalidasi session dan mengisi data.user sebelum sampai di sini.
export async function onRequestGet({ data }) {
  return Response.json({ user: data.user });
}
