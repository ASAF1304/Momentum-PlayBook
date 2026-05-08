// app/auth/forgot-password/page.tsx — redirects to canonical /forgot-password
import { redirect } from 'next/navigation';
export default function OldForgotPasswordRedirect() {
  redirect('/forgot-password');
}
