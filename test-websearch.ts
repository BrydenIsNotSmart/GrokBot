#!/usr/bin/env bun

import { performWebSearch } from "./src/utils/webSearch";

async function testWebSearch() {
  console.log("🔍 Testing web search functionality...");
  
  try {
    const result = await performWebSearch("latest AI developments 2025");
    
    if (result.success) {
      console.log("✅ Web search successful!");
      console.log("\n📄 Result:");
      console.log(result.result);
    } else {
      console.error("❌ Web search failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testWebSearch();
