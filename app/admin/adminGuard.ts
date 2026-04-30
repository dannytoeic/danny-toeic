export type LoggedInAdmin = {
  username: string;
  role: string;
};

export function getLoggedInAdmin(): LoggedInAdmin | null {
  if (typeof window === 'undefined') return null;

  const savedAdmin = localStorage.getItem('loggedInAdmin');
  if (!savedAdmin) return null;

  try {
    const parsed = JSON.parse(savedAdmin) as LoggedInAdmin;

    if (!parsed || parsed.role !== 'admin') {
      localStorage.removeItem('loggedInAdmin');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(error);
    localStorage.removeItem('loggedInAdmin');
    return null;
  }
}