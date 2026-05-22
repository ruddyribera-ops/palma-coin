import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'palma-coin-dev-secret-change-in-production';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticate(req, res, next) {
  // Try access token first, then refresh token as fallback
  let token = req.cookies.palma_token;
  if (!token) token = req.cookies.palma_refresh;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireTeacher(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'teacher' || req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
}

export { JWT_SECRET };

export default { generateAccessToken, generateRefreshToken, verifyToken, authenticate, requireTeacher, JWT_SECRET };
