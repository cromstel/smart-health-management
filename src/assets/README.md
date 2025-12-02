# Assets Folder

This folder contains all static assets for the Health Management application.

## Structure

```
assets/
├── images/                 # Image files
│   ├── logo.png           # Application logo
│   ├── favicon.png        # Browser favicon
│   ├── avatar-placeholder.png    # Default user avatar
│   ├── hospital-placeholder.png  # Default hospital image
│   ├── medical-icon.png   # Generic medical icon
│   ├── background-image.png     # Background images
│   ├── prescription-icon.png    # Prescription related icon
│   ├── calendar-icon.png        # Calendar/appointment icon
│   ├── dashboard-bg.png         # Dashboard background
│   └── user-avatar.png          # User profile avatar
└── README.md             # This file
```

## Usage

### Importing Images in React Components

```typescript
import logo from '../assets/images/logo.png';
import avatarPlaceholder from '../assets/images/avatar-placeholder.png';

// In your component
<img src={logo} alt="Health Management Logo" />
<img src={avatarPlaceholder} alt="User Avatar" className="w-10 h-10 rounded-full" />
```

### Adding New Images

1. Place your image files in the appropriate subdirectory under `assets/`
2. Import them in your components as shown above
3. Use descriptive names that indicate the image's purpose

### Image Guidelines

- **File Formats**: Use PNG for transparency, JPG for photos, SVG for icons when possible
- **Naming**: Use kebab-case or camelCase consistently (e.g., `user-avatar.png` or `userAvatar.png`)
- **Sizes**: Optimize images for web use to improve performance
- **Accessibility**: Always include meaningful alt text for images

### Replacing Placeholders

All current image files are placeholders (0 bytes). Simply replace them with your actual image files while keeping the same filenames to maintain compatibility with existing imports.
