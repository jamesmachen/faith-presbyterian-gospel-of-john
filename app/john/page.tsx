import type { Metadata } from "next";
import JohnClassPage from "../john-class-page";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Gospel of John | Faith Presbyterian Church Sunday School",
  description: "Study resources, weekly passages, reflection questions, and a class outline for exploring the Gospel of John.",
  alternates: { canonical: withBasePath("/john") },
  openGraph: { title: "The Gospel of John — Come and See", description: "Resources for a Faith Presbyterian Church Sunday School study of the Gospel of John.", type: "website", url: withBasePath("/john"), images: [{ url: withBasePath("/og.png"), width: 1536, height: 1024, alt: "Faith Presbyterian Church — The Gospel of John — Come and See" }] },
};

export default JohnClassPage;
