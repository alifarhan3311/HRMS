/**
 * features/auth/validation/auth.validation.js
 * Yup schema for the login form.
 */
import * as yup from 'yup';

export const loginSchema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});
