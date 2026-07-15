/**
 * features/payroll/store/payroll.slice.js
 * Local UI-only state for the payroll feature (filters, selected record,
 * modal open/closed). Server data itself lives in RTK Query's cache, not here.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedId: null,
  filters: {},
  isFormOpen: false,
};

const payrollSlice = createSlice({
  name: 'payroll',
  initialState,
  reducers: {
    setSelectedId(state, action) {
      state.selectedId = action.payload;
    },
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    openForm(state) {
      state.isFormOpen = true;
    },
    closeForm(state) {
      state.isFormOpen = false;
      state.selectedId = null;
    },
  },
});

export const { setSelectedId, setFilters, openForm, closeForm } = payrollSlice.actions;
export default payrollSlice.reducer;
