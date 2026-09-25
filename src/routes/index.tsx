import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "../components/ProductPage";
export const Route = createFileRoute("/")({ component: ProductPage });
