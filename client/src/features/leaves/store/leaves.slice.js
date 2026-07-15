/**
 * features/leaves/store/leaves.slice.js
 * Local UI-only state for the leaves feature (filters, selected record,
 * modal open/closed). Server data itself lives in RTK Query's cache, not here.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedId: null,
  filters: {},
  isFormOpen: false,
};

const leavesSlice = createSlice({
  name: 'leaves',
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

export const { setSelectedId, setFilters, openForm, closeForm } = leavesSlice.actions;
export default leavesSlice.reducer;
