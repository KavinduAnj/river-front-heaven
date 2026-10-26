"use client";
import { createContext, useContext } from "react";

// Gives any staff page the logged-in user: const user = useStaff();
export const StaffContext = createContext(null);
export const useStaff = () => useContext(StaffContext);
