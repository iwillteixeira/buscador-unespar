<img width="1863" height="915" alt="image" src="https://github.com/user-attachments/assets/25970833-8de1-4148-9ab8-9572433406fd" />


# React API Table - ARP Search System

A powerful React application for searching and managing ARP (Ata de Registro de Preços - Price Registration Records) items from Brazilian government procurement system.

## Features

### 🔍 Search & Filter
- **Keyword Search**: Search for items using PDM (Padrão Descritivo de Material) codes and descriptions
- **Advanced Filters**: 
  - Status filter (Active/Expired)
  - Supplier name filter
  - Supplier CNPJ filter
  - State (UF) filter
  - PDM code filter
- **Auto-suggestions**: Real-time PDM code suggestions as you type
- **Smart filtering**: Automatically excludes items with zero balance

### 📊 Data Management
- **Sortable Columns**: Click any column header to sort data
- **Column Visibility**: Show/hide any column using the visibility control panel
- **Pagination**: Navigate through results with pagination controls
- **Page Size Control**: Choose between 10, 25, 50, or 100 items per page

### 📥 Export Capabilities
- **Excel Export**: Export selected items or entire page to Excel format
- **Batch Selection**: Select multiple items using checkboxes
- **Select All**: Quick select all items on current page

### 📞 Supplier Information
- **CNPJ Lookup**: Fetch supplier contact information automatically
- **Multiple API Integration**: 
  - OpenCNPJ API
  - BrasilAPI
- **Contact Details**: Get phone and email from CNPJ data

### 💾 Data Caching
- **Load All Data**: Option to load and cache all results for faster filtering
- **IndexedDB Storage**: Persistent cache storage in browser
- **Progress Indicator**: Visual progress bar during data loading

### 📱 Responsive Design
- **Horizontal Scroll**: Synchronized top and table scrolling
- **Sticky Headers**: Column headers stay visible while scrolling
- **Sticky Checkbox Column**: Selection column stays visible

## Technology Stack

- **React** 19.2.0 - UI Framework
- **TypeScript** 5.9.3 - Type Safety
- **Vite** 8.0.0-beta.13 - Build Tool
- **TanStack React Query** - Data Fetching & Caching
- **XLSX** - Excel Export
- **Axios** - HTTP Client

## Prerequisites

Before installing, ensure you have the following installed on your Ubuntu system:

- **Node.js**: v20.20.0 or higher
- **npm**: v10.8.2 or higher

## Installation on Ubuntu Linux

### Step 1: Install Node.js and npm

```bash
# Update package list
sudo apt update

# Install Node.js and npm using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.20.0 or higher
npm --version   # Should show v10.8.2 or higher
```

### Step 2: Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd react-api-table
```

### Step 3: Install Dependencies

```bash
# Install all project dependencies
npm install
```

### Step 4: Run the Application

#### Development Mode

```bash
# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

#### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

The application uses a proxy configuration in `vite.config.ts` to connect to the ARP API. Make sure the API endpoint is accessible:

```typescript
'/serpro-api': {
  target: 'https://gateway.arp.serpro.gov.br',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/serpro-api/, '')
}
```

## Usage

1. **Search for Items**:
   - Enter a keyword in the search box
   - Click "Buscar" or press Enter
   - Use PDM suggestions for accurate searches

2. **Apply Filters**:
   - Click "🔧 Filtros Avançados" to show advanced filters
   - Set desired filters (status, supplier, state, etc.)
   - Click "Buscar" to apply filters

3. **Manage Columns**:
   - Use the visibility control panel above the table
   - Click on any column button to show/hide it
   - Green (✓) = visible, Gray (✗) = hidden

4. **Export Data**:
   - Select items using checkboxes (optional)
   - Click "📥 Exportar" button
   - Exports selected items or entire page to Excel

5. **Get Supplier Contacts**:
   - Click "📞 Buscar" button in the phone column
   - System fetches CNPJ data from multiple APIs
   - Phone and email are displayed automatically

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.
