import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiService } from "./services/apiService";
import counterSlice from "./slices/counterSlice";
import userSlice from "./slices/userSlice";

export const store = configureStore({
  reducer: {
    [apiService.reducerPath]: apiService.reducer,
    counter: counterSlice,
    user: userSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }).concat(apiService.middleware),
  devTools: process.env.NODE_ENV !== "production",
});

// Setup RTK Query listeners for refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
