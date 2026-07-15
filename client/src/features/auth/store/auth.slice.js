/**
 * features/auth/store/auth.slice.js
 * Client-side session state derived from auth responses — current user,
 * role, permission flags. The tokens themselves stay in HttpOnly cookies
 * and are never touched by JS/Redux.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null, // { id, fullName, role, companyId, branchId }
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearCredentials(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
