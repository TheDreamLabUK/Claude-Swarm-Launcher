#!/bin/bash

# Model upgrade regression test script
# Tests the new model identifiers work correctly

echo "AI Agent Swarm - Model Upgrade Test Suite"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"

    echo -n "Testing $test_name... "

    if timeout 30s bash -c "$command" 2>/dev/null | grep -q "$expected_pattern"; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
    fi
}

# Test Anthropic Claude
echo -e "\n${YELLOW}Testing Anthropic Models${NC}"
run_test "Claude Opus 4" "claude-flow --model claude-opus-4 --help" "claude-opus-4"
run_test "Claude Sonnet 4" "claude-flow --model claude-sonnet-4 --help" "claude-sonnet-4"

# Test Google Gemini
echo -e "\n${YELLOW}Testing Google Models${NC}"
run_test "Gemini 2.5 Pro" "npx @google/generative-ai --model gemini-2.5-pro --help" "gemini-2.5-pro"
run_test "Gemini 2.5 Flash" "npx @google/generative-ai --model gemini-2.5-flash --help" "gemini-2.5-flash"

# Test OpenAI
echo -e "\n${YELLOW}Testing OpenAI Models${NC}"
run_test "GPT-4.1 mini" "openai api models.list | grep gpt-4.1-mini" "gpt-4.1-mini"
run_test "o3" "openai api models.list | grep o3" "o3"

# Summary
echo -e "\n${YELLOW}Test Results Summary${NC}"
echo "=================="
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! Model upgrade successful.${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please check model configurations.${NC}"
    exit 1
fi