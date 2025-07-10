# CRM Bot Test Suite

## 🧪 Test Structure (Post-Consolidation)

After cleaning up from **69 files** to **11 files** (84% reduction!), here's our streamlined test organization:

### **Core Test Suite**
1. **`test-suite.js`** - Comprehensive automated test suite with MongoDB integration
   - Fuzzy search tests (rain → raine, etc.)
   - Note operations with preview mode
   - Error handling and edge cases
   - Color-coded output with tool usage tracking
   - **Usage**: `npm run test:suite`

### **Feature-Specific Tests**
2. **`test-image-processing.js`** - Claude Sonnet 4 vision capabilities
   - Image download and base64 encoding
   - Vision API integration testing
   - Fallback behavior validation
   - **Usage**: `npm run test:image`

3. **`test-both-features.js`** - Multi-feature integration
   - Image processing + note operations
   - Complex workflow validation
   - **Usage**: `node tests/test-both-features.js`

4. **`test-delete-note.js`** - Note deletion functionality
   - Preview mode testing
   - Safety validation
   - **Usage**: `node tests/test-delete-note.js`

### **Integration Tests**
5. **`test-bot.js`** - Basic search and threading
   - Entity search scenarios
   - Thread handling
   - **Usage**: `node tests/test-bot.js`

6. **`quick-feature-test.js`** - Fast smoke tests
   - Quick validation of core features
   - **Usage**: `node tests/quick-feature-test.js`

### **Infrastructure Tests**
7. **`test-timeout-demo.js`** - Timeout and reliability testing
   - Response time validation
   - Error handling under load
   - **Usage**: `node tests/test-timeout-demo.js`

### **CI/CD**
8. **`test-suite-ci.js`** - Continuous integration wrapper
   - Automated CI pipeline integration
   - **Usage**: CI systems only

### **Development Utilities**
9. **`view-test-history.js`** - MongoDB test analytics
   - Test result trends and analysis
   - **Usage**: `node tests/view-test-history.js`

10. **`view-test-logs.js`** - Local test log viewer
    - File-based test result viewing
    - **Usage**: `node tests/view-test-logs.js`

11. **`../local-bot.js`** - Interactive testing interface
    - Live agent testing with Claude Agent
    - **Usage**: `npm run local`

## 🚨 Deleted Files (52 files removed)

### MongoDB Tests (6 files → 0)
- Consolidated into main test suite's database handling
- All connection testing now handled by core tests

### Notes Tests (10 files → 1) 
- Multiple redundant note creation/reading tests
- Consolidated into `test-delete-note.js` and main suite

### Search Tests (8 files → 0)
- Search functionality now covered by main test suite
- Fuzzy search specifically tested in `test-suite.js`

### Image Tests (4 files → 1)
- Multiple image processing tests merged into `test-image-processing.js`

### Slack Tests (3 files → 0)  
- Slack integration now tested within feature tests

### Parser/Debug Tests (6 files → 0)
- Old ReAct framework testing removed
- Debug functionality replaced by better logging

### Legacy/Redundant (15+ files → 0)
- Duplicate tests with slight variations
- Old framework-specific tests
- Test conversation artifacts

## 📊 Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Total Files** | 69 | 11 | -84% |
| **Total Size** | ~1.5MB | ~0.5MB | -67% |
| **Redundant Tests** | 35+ | 0 | -100% |
| **Test Categories** | Scattered | 4 clear categories | +∞ |
| **Maintainability** | Nightmare | Manageable | 🎉 |

## 🎯 Running All Tests

```bash
# Core comprehensive test
npm run test:suite

# Image processing test  
npm run test:image

# Quick smoke test
node tests/quick-feature-test.js

# Interactive testing
npm run local

# View test analytics
node tests/view-test-history.js
```

## 🔧 Test Development Guidelines

### When to Add a New Test File
- **New major feature** that can't fit in existing categories
- **Integration testing** for complex multi-step workflows  
- **Performance testing** for specific scenarios

### When to Extend Existing Tests
- **Bug fixes** → Add case to relevant existing test
- **Feature enhancements** → Extend existing feature test
- **Edge cases** → Add to comprehensive test suite

### Naming Convention
- `test-[feature-name].js` - Feature-specific tests
- `test-[integration-name].js` - Integration scenarios
- `view-[data-type].js` - Utilities for viewing data

## 🏆 Quality Standards

All tests must:
1. ✅ Use Claude Agent (not legacy ReAct)
2. ✅ Include clear success/failure criteria
3. ✅ Have descriptive output with timing info
4. ✅ Handle errors gracefully
5. ✅ Test realistic scenarios (not toy examples)

---

*Last updated: July 10, 2025 - Post Claude Agent Migration*