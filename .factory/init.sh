#!/bin/bash
set -e

cd /Users/ashishhuddar/Desktop/worktrees/funny-spoons-appear-185

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "Environment ready."
