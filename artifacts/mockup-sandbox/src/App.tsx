import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ClipboardList, Settings, ChefHat, TrendingUp, 
  Plus, Search, AlertTriangle, Package, ShoppingCart, 
  Layers, ChevronDown, ChevronUp, Edit3, MapPin, CheckCircle2, X, 
  DollarSign, Utensils, Calculator, ShieldCheck, Truck, Boxes, 
  Banknote, Trash, Trash2, ClipboardCheck, Thermometer, MessageSquare, Clock,
  Sun, Moon, Upload, PackageCheck, FileText, Store, Lightbulb, Info
} from 'lucide-react';

/**
 * O' BLACK SHEEP PUB: KITCHEN MANAGER PRO
 * Definitive Operational Suite (Clean & Stable)
 */

// --- CONFIGURATION & DATA ---

const WALK_ORDER = ['Dry Storage', 'Walk-in', 'Back Freezer', 'Line Freezer', 'Salad Station', 'Supply Room', 'Up Front'];
const PREP_STATIONS = ['Salad Station', 'Hot Line', 'Steam Table', 'Prep Area', 'Bakery'];
const WASTE_REASONS = ['Expired', 'Cook Error', 'Spilled', 'Dropped', 'Returned', 'Quality Issue'];

const EQUIPMENT_LIST = [
  { id: 'walkin', name: 'Walk-in', type: 'refrig' },
  { id: 'back_freezer', name: 'Back Freezer', type: 'freezer' },
  { id: 'main_freezer', name: 'Main Freezer', type: 'freezer' },
  { id: 'line_reachin', name: 'Line Reach-in', type: 'refrig' },
  { id: 'main_reachin', name: 'Main Reach-in', type: 'refrig' },
  { id: 'salad_reachin', name: 'Salad Reach-in', type: 'refrig' },
  { id: 'steam_table', name: 'Steam Table', type: 'hot' },
  { id: 'soup_croc', name: 'Soup Croc', type: 'hot' }
];

const INITIAL_INVENTORY = [
  { id: 'ds-1', name: 'All-purpose Flour', category: 'Dry Goods', storage: 'Dry Storage', stockedAt: 'Dry Storage', unit: 'Bags', caseSize: 1, costPerCase: 28.50, lastPrice: 27.00, distributor: 'US Foods', itemNum: '9401928', onHand: 10, unitPar: 15, leadTime: 3, yieldPct: 100 },
  { id: 'ds-2', name: 'Russet Potatoes (50lb)', category: 'Produce', storage: 'Dry Storage', stockedAt: 'Prep Station', unit: 'Bags', caseSize: 1, costPerCase: 24.00, lastPrice: 24.00, distributor: 'Performance', itemNum: '50-BAG', onHand: 2, unitPar: 5, leadTime: 2, yieldPct: 85 },
  { id: 'ds-6', name: 'Brioche Buns', category: 'Bakery', storage: 'Dry Storage', stockedAt: 'Hot Line', unit: 'Buns', caseSize: 48, costPerCase: 32.00, lastPrice: 32.00, distributor: 'Performance', itemNum: '4389', onHand: 48, unitPar: 144, leadTime: 1, yieldPct: 100 },
  { id: 'wi-1', name: 'Burger Beef (8oz)', category: 'Proteins', storage: 'Walk-in', stockedAt: 'Hot Line', unit: 'Patties', caseSize: 40, costPerCase: 135.00, lastPrice: 128.00, distributor: 'Performance', itemNum: '88231', onHand: 20, unitPar: 80, leadTime: 2, yieldPct: 100 },
  { id: 'wi-4', name: 'Chicken Breasts', category: 'Proteins', storage: 'Walk-in', stockedAt: 'Hot Line', unit: 'lbs', caseSize: 40, costPerCase: 105.00, lastPrice: 105.00, distributor: 'Performance', itemNum: '55210', onHand: 10, unitPar: 40, leadTime: 2, yieldPct: 75 },
  { id: 'wi-6', name: 'Shredded Mozzarella', category: 'Dairy', storage: 'Walk-in', stockedAt: 'Prep Station', unit: '5lb Bags', caseSize: 6, costPerCase: 85.00, lastPrice: 80.00, distributor: 'Performance', itemNum: '4421', onHand: 2, unitPar: 6, leadTime: 2, yieldPct: 100 },
  { id: 'sr-3', name: 'Sprite Syrup Box', category: 'Service', storage: 'Supply Room', stockedAt: 'Front', unit: 'Box', caseSize: 1, costPerCase: 95.00, lastPrice: 95.00, distributor: 'Performance', itemNum: '2204', onHand: 0, unitPar: 2, leadTime: 4, yieldPct: 100 },
];

const INITIAL_PREP = [
  { id: 'p1', name: 'Bang Bang Sauce', station: 'Salad Station', unit: 'Quarts', onHand: 2, par: 12, batchSize: 4, servingsPerBatch: 16, ingredients: [{ id: 'wi-6', qty: 0.25 }], instructions: "Transfer into squeeze bottles prior to service.", type: 'sauce' },
  { id: 'p2', name: 'Texas Petal Sauce', station: 'Hot Line', unit: 'Quarts', onHand: 1, par: 8, batchSize: 4, servingsPerBatch: 12, ingredients: [], instructions: "Linked to Hoof Kick burger volume.", type: 'sauce' },
  { id: 'p3', name: 'Meatballs', station: 'Hot Line', unit: 'Portions', onHand: 10, par: 40, batchSize: 20, servingsPerBatch: 20, ingredients: [{ id: 'wi-1', qty: 10 }], instructions: "Half-pound patties portioned for char-broiling.", type: 'protein' },
  { id: 'p4', name: 'Chicken Tenders', station: 'Hot Line', unit: 'Orders', onHand: 5, par: 30, batchSize: 10, servingsPerBatch: 10, ingredients: [{ id: 'wi-4', qty: 5 }], instructions: "Pre-sliced and stored in chicken slurry.", type: 'protein' },
];

const INITIAL_MENU = [
  { id: 'm15', section: 'Burgers & Sandwiches', name: 'Classic Burger', price: 14.00 },
  { id: 'm16', section: 'Burgers & Sandwiches', name: 'Mushroom Swiss', price: 16.00 },
  { id: 'm17', section: 'Burgers & Sandwiches', name: 'Pub Burger', price: 17.00 },
  { id: 'm18', section: 'Burgers & Sandwiches', name: 'Hoof Kick Burger', price: 17.00 },
  { id: 'm19', section: 'Burgers & Sandwiches', name: 'Turkey Melt', price: 14.00 },
  { id: 'm20', section: 'Burgers & Sandwiches', name: 'Reuben', price: 15.00 },
  { id: 'm6', section: 'From The Sea', name: 'Bang Bang Shrimp', price: 13.00 },
  { id: 'm21', section: 'From The Sea', name: 'Haddock Sandwich', price: 15.00 },
  { id: 'm24', section: 'From The Sea', name: 'Fish & Chips', price: 18.00 },
  { id: 'm25', section: 'Pasta', name: 'Spaghetti & Meatballs', price: 16.00 },
  { id: 'm1', section: 'From The Oven', name: 'Buffalo Chicken Dip', price: 12.00 },
  { id: 'm2', section: 'From The Oven', name: 'Soft Pretzels (2)', price: 10.00 },
  { id: 'm3', section: 'From The Oven', name: 'Mozzarella Sticks', price: 11.00 },
  { id: 'm_f1', section: 'Flatbreads', name: 'Margherita Flatbread', price: 12.00 },
  { id: 'm_f2', section: 'Flatbreads', name: 'Pepperoni Flatbread', price: 13.00 },
  { id: 'm4', section: 'Pub Grub', name: 'Fried Pickles', price: 10.00 },
  { id: 'm5', section: 'Pub Grub', name: 'Corn Nuggets', price: 10.00 },
  { id: 'm7', section: 'Pub Grub', name: 'Chicken Tenders', price: 13.00 },
  { id: 'm13', section: 'Pub Grub', name: 'Irish Stew', price: 8.00 },
  { id: 'm14', section: 'Pub Grub', name: 'Guinness Onion Soup', price: 9.00 },
  { id: 'm22', section: 'Pub Grub', name: 'Bangers & Mash', price: 17.00 },
  { id: 'm23', section: 'Pub Grub', name: 'Shepherds Pie', price: 17.00 },
  { id: 'm26', section: 'Pub Grub', name: 'Mac & Cheese', price: 13.00 },
  { id: 'm8', section: 'Chicken Wings', name: 'Traditional (10)', price: 16.00 },
  { id: 'm9', section: 'Chicken Wings', name: 'Boneless (10)', price: 13.00 },
  { id: 'm10', section: 'Salads', name: 'Pub House Salad', price: 10.00 },
  { id: 'm11', section: 'Salads', name: 'Caesar Salad', price: 11.00 },
  { id: 'm12', section: 'Salads', name: 'Kickin Chicken Salad', price: 15.00 },
  { id: 'm_s1', section: 'Sides', name: 'French Fries', price: 4.00 },
  { id: 'm_s2', section: 'Sides', name: 'Sweet Potato Fries', price: 5.00 },
  { id: 'm_s3', section: 'Sides', name: 'Onion Rings', price: 6.00 },
  { id: 'm_s4', section: 'Sides', name: 'Mashed Potatoes', price: 4.00 },
];

const calculateUnitCost = (item) => {
  const cost = parseFloat(item?.costPerCase) || 0;
  const size = parseFloat(item?.caseSize) || 1;
  return (cost / size).toFixed(2);
};

// --- HELPER UI ATOMS ---

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${active ? 'bg-emerald-500 text-slate-900 shadow-lg font-bold' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
      {icon} <span className="text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, color, subtext }) {
  const colors = { 
    blue: 'bg-blue-50 text-blue-600 border-blue-100', 
    amber: 'bg-amber-50 text-amber-600 border-amber-100', 
    rose: 'bg-rose-50 text-rose-600 border-rose-100', 
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100' 
  };
  return (
    <div className={`bg-white p-6 rounded-[30px] border-2 ${colors[color].split(' ')[2]} shadow-lg transition-all hover:scale-105 duration-300 relative overflow-hidden group`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 opacity-20 ${colors[color].split(' ')[0]}`}></div>
      <div className={`p-3 w-fit rounded-xl mb-4 shadow-sm ${colors[color].split(' ')[0]} ${colors[color].split(' ')[1]}`}>{icon}</div>
      <h3 className="text-3xl font-black mb-1 tracking-tighter text-slate-800">{String(value)}</h3>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.1em] mt-2">{label}</p>
      {subtext && <p className="text-[9px] font-medium text-slate-400 uppercase mt-1">{String(subtext)}</p>}
    </div>
  );
}

function CheckToggle({ label, active, onToggle }) {
  return (
    <button onClick={onToggle} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${active ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
      <span className="text-xs font-semibold tracking-wide">{label}</span>
      {active ? <CheckCircle2 size={20} className="text-emerald-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
    </button>
  );
}

// --- MAIN APPLICATION COMPONENT ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [prepItems, setPrepItems] = useState(INITIAL_PREP);
  const [menuItems, setMenuItems] = useState(INITIAL_MENU);
  const [waste, setWaste] = useState([]);
  const [receipts, setReceipts] = useState([]); 
  const [monthlySales, setMonthlySales] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState([
    { id: 1, text: "Rotation: Use older red sauce first", type: 'rotation' },
    { id: 2, text: "Safety: Drained sauerkraut stored in reach-in", type: 'safety' }
  ]);
  const [safety, setSafety] = useState({ 
    open: EQUIPMENT_LIST.reduce((acc, eq) => ({ ...acc, [eq.id]: '' }), {}),
    close: EQUIPMENT_LIST.reduce((acc, eq) => ({ ...acc, [eq.id]: '' }), {}),
    checks: {
      steamTableWater: false,
      fryerOil: false,
      soupCrocWater: false,
      equipmentWorking: false,
      sanitizerBuckets: false,
      heatLampsOn: false
    }
  });

  const stats = useMemo(() => {
    const lowStock = inventory.filter(i => parseFloat(i.onHand || 0) < parseFloat(i.unitPar || 0));
    const priceHikes = inventory.filter(i => i.lastPrice && ((i.costPerCase - i.lastPrice) / i.lastPrice) > 0.05);
    const lowPrep = prepItems.filter(p => parseFloat(p.onHand || 0) < parseFloat(p.par || 0));
    const totalWasteValue = waste.reduce((acc, curr) => acc + (parseFloat(curr.qty || 0) * parseFloat(curr.unitCost || 0)), 0);

    const shoppingList = lowStock.map(item => {
      const unitsNeeded = Math.max(0, parseFloat(item.unitPar) - parseFloat(item.onHand));
      const casesNeeded = Math.ceil(unitsNeeded / (parseFloat(item.caseSize) || 1));
      return { ...item, casesNeeded, unitsNeeded };
    });

    const currentSales = monthlySales[selectedMonth] || {};
    let totalGross = 0;
    let totalProfit = 0;
    Object.keys(currentSales).forEach(id => {
      const s = currentSales[id];
      const gross = (parseFloat(s.sold) || 0) * (parseFloat(s.avgPrice) || 0);
      const profit = ((parseFloat(s.avgPrice) || 0) - (parseFloat(s.cost) || 0)) * (parseFloat(s.sold) || 0);
      totalGross += gross;
      totalProfit += profit;
    });

    return { lowStock, lowPrep, totalWasteValue, totalItems: inventory.length, shoppingList, totalGross, totalProfit, priceHikes };
  }, [inventory, prepItems, waste, monthlySales, selectedMonth]);

  // ACTIONS
  const updateInventoryField = (id, field, value) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const updatePrepItem = (id, updatedItem) => {
    setPrepItems(prev => prev.map(item => item.id === id ? updatedItem : item));
  };

  const updateMenuField = (id, field, value) => {
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const logWaste = (itemId, qty, reason) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const unitCost = calculateUnitCost(item);
    const entry = { id: Date.now(), itemName: item.name, qty: parseFloat(qty), unit: item.unit || 'units', unitCost: parseFloat(unitCost), reason, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setInventory(prev => prev.map(i => i.id === itemId ? { ...i, onHand: Math.max(0, parseFloat(i.onHand) - parseFloat(qty)) } : i));
    setWaste([entry, ...waste]);
  };

  const receiveInventory = (receivals) => {
    let updatedReceipts = [...receipts];
    setInventory(prev => {
      let nextInv = [...prev];
      receivals.forEach(entry => {
        const itemIndex = nextInv.findIndex(i => i.id === entry.itemId);
        if (itemIndex > -1) {
          const item = nextInv[itemIndex];
          const qtyReceived = (parseFloat(entry.cases || 0) * parseFloat(item.caseSize)) + parseFloat(entry.units || 0);

          nextInv[itemIndex] = {
            ...item,
            onHand: parseFloat(item.onHand) + qtyReceived,
            lastPrice: item.costPerCase,
            costPerCase: parseFloat(entry.price)
          };

          updatedReceipts.unshift({
            id: Date.now() + Math.random(),
            itemName: item.name,
            vendor: item.distributor,
            qty: qtyReceived,
            unit: item.unit || 'units',
            price: parseFloat(entry.price),
            invoiceNum: entry.invoiceNum,
            date: new Date().toLocaleDateString()
          });
        }
      });
      return nextInv;
    });
    setReceipts(updatedReceipts);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-emerald-200">
      <nav className="w-64 bg-slate-900 text-white flex flex-col p-4 shrink-0 overflow-y-auto border-r-4 border-slate-800">
        <div className="flex items-center gap-3 mb-10 px-2 mt-2">
          <div className="bg-emerald-500 p-2 rounded-lg text-slate-900 shadow-xl"><ChefHat size={24} /></div>
          <div>
            <h1 className="font-black text-sm tracking-tight text-white uppercase">O’ Black Sheep</h1>
            <p className="text-emerald-400 text-[9px] font-bold tracking-[0.2em] uppercase">Manager Pro</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <NavItem active={activeTab === 'dashboard'} icon={<LayoutDashboard size={18}/>} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <NavItem active={activeTab === 'linecheck'} icon={<ClipboardCheck size={18}/>} label="Line Check" onClick={() => setActiveTab('linecheck')} />
          <NavItem active={activeTab === 'walkthrough'} icon={<ClipboardList size={18}/>} label="Inventory Walk" onClick={() => setActiveTab('walkthrough')} />
          <NavItem active={activeTab === 'receiving'} icon={<PackageCheck size={18}/>} label="Receiving Hub" onClick={() => setActiveTab('receiving')} />
          <NavItem active={activeTab === 'prep'} icon={<Utensils size={18}/>} label="Prep Hub" onClick={() => setActiveTab('prep')} />
          <NavItem active={activeTab === 'sales'} icon={<TrendingUp size={18}/>} label="Sales Tracking" onClick={() => setActiveTab('sales')} />
          <NavItem active={activeTab === 'costing'} icon={<Calculator size={18}/>} label="Costing Sandbox" onClick={() => setActiveTab('costing')} />
          <NavItem active={activeTab === 'waste'} icon={<Trash2 size={18}/>} label="Waste Hub" onClick={() => setActiveTab('waste')} />
          <NavItem active={activeTab === 'management'} icon={<Settings size={18}/>} label="Command Center" onClick={() => setActiveTab('management')} />
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <div className="max-w-7xl mx-auto p-8">
          {activeTab === 'dashboard' && <Dashboard stats={stats} selectedMonth={selectedMonth} notes={notes} setNotes={setNotes} />}
          {activeTab === 'linecheck' && <LineCheck safety={safety} setSafety={setSafety} />}
          {activeTab === 'walkthrough' && <Walkthrough inventory={inventory} onUpdate={updateInventoryField} />}
          {activeTab === 'receiving' && <Receiving inventory={inventory} receipts={receipts} onReceive={receiveInventory} />}
          {activeTab === 'prep' && <PrepHub prepItems={prepItems} inventory={inventory} onUpdate={updatePrepItem} onAdd={(it) => setPrepItems([...prepItems, {...it, id: `prep-${Date.now()}`}])} />}
          {activeTab === 'sales' && <SalesTracking menuItems={menuItems} monthlySales={monthlySales} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} updateSales={(id, f, v) => setMonthlySales(prev => ({ ...prev, [selectedMonth]: { ...(prev[selectedMonth] || {}), [id]: { ...(prev[selectedMonth]?.[id] || { sold: 0, cost: 0, avgPrice: (menuItems.find(m => m.id === id)?.price || 0) }), [f]: v } } }))} onAddMenu={(it) => setMenuItems([...menuItems, {...it, id: `menu-${Date.now()}`}])} onEditMenu={updateMenuField} onDeleteMenu={(id) => setMenuItems(menuItems.filter(m => m.id !== id))} />}
          {activeTab === 'costing' && <CostingTool inventory={inventory} />}
          {activeTab === 'catalog' && <Catalog inventory={inventory} getUnitCost={calculateUnitCost} />}
          {activeTab === 'waste' && <WasteLogger inventory={inventory} waste={waste} onLog={logWaste} />}
          {activeTab === 'management' && <Management inventory={inventory} onUpdate={updateInventoryField} />}
        </div>
      </main>
    </div>
  );
}

// --- MODULE COMPONENTS ---

function Dashboard({ stats, selectedMonth, notes, setNotes }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Kitchen Pulse</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 flex items-center gap-2"><ChefHat size={14}/> Operations Hub • O’ Black Sheep Pub</p>
        </div>
        {stats.priceHikes.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-200 px-4 py-3 rounded-2xl animate-bounce flex items-center gap-3 shadow-sm">
            <AlertTriangle className="text-rose-500" size={20} />
            <p className="text-xs font-bold text-rose-600 uppercase">Price Fluctuation (+5%) Detected</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Database SKUs" value={String(stats.totalItems)} color="blue" icon={<Layers size={20}/>}/>
        <StatCard label="Inventory Low" value={String(stats.lowStock.length)} color="amber" icon={<AlertTriangle size={20}/>}/>
        <StatCard label="Monthly Revenue" value={`$${stats.totalGross.toFixed(0)}`} color="emerald" icon={<Banknote size={20}/>} subtext={selectedMonth} />
        <StatCard label="Est. Monthly Profit" value={`$${stats.totalProfit.toFixed(0)}`} color="rose" icon={<TrendingUp size={20}/>} subtext={selectedMonth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[40px] border-2 border-slate-100 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-50 bg-slate-900 text-white flex justify-between items-center">
            <h3 className="font-bold text-lg tracking-widest uppercase flex items-center gap-3"><ShoppingCart className="text-emerald-400" /> Automated Order Sheet</h3>
            <div className="px-3 py-1 bg-emerald-500 text-slate-900 rounded-full font-bold text-[10px] uppercase tracking-widest animate-pulse">Rounded to Full Case</div>
          </div>
          <div className="p-8 grid grid-cols-2 gap-8 divide-x-2 divide-slate-100">
            <div>
              <p className="text-xs font-black text-slate-800 uppercase mb-4 tracking-wider">Performance Foodservice</p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-4 scrollbar-thin">
                {stats.shoppingList.filter(i => i.distributor === 'Performance').map(item => (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-emerald-200 transition-all">
                    <span className="text-xs font-bold uppercase truncate text-slate-700">{item.name}</span>
                    <span className="text-emerald-600 font-black text-xs">BUY {item.casesNeeded} CS</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pl-8">
              <p className="text-xs font-black text-slate-800 uppercase mb-4 tracking-wider">Other Vendors</p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-4 scrollbar-thin">
                {stats.shoppingList.filter(i => i.distributor !== 'Performance').map(item => (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm transition-all hover:bg-slate-50">
                    <span className="text-xs font-bold uppercase truncate text-slate-700">{item.name}</span>
                    <span className="text-blue-500 font-black text-xs">BUY {item.casesNeeded} CS</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[40px] p-8 shadow-2xl relative overflow-hidden border-2 border-slate-800 h-fit">
          <h3 className="text-white font-bold text-lg uppercase tracking-widest flex items-center gap-3 mb-6"><MessageSquare className="text-emerald-400" /> Kitchen Whiteboard</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
            {notes.map(n => (
              <div key={n.id} className={`p-4 rounded-2xl border-l-4 ${n.type === 'rotation' ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-blue-500 bg-blue-500/10 text-blue-300'}`}>
                <p className="font-bold text-xs uppercase tracking-wide">{n.text}</p>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-800 flex gap-2">
              <input type="text" className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none flex-1 font-medium" placeholder="Add shift note... (Press Enter)" onKeyDown={e => { if (e.key === 'Enter' && e.target.value) { setNotes([...notes, { id: Date.now(), text: e.target.value, type: 'shift' }]); e.target.value = ''; }}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LineCheck({ safety, setSafety }) {
  const [activeShift, setActiveShift] = useState(null);

  const getStatusColor = (eq, val) => {
    if (!val) return 'text-slate-300';
    const num = parseFloat(val);
    if (eq.type === 'refrig' && num > 40) return 'text-rose-500';
    if (eq.type === 'freezer' && num > 10) return 'text-rose-500';
    if (eq.type === 'hot' && num < 140) return 'text-rose-500';
    return 'text-emerald-500';
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
      <header className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl relative overflow-hidden flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Line & Safety Log</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Blueprint Protocols • Shift Readiness</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => setActiveShift('open')} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 group shadow-md">
              <Sun size={20} className="text-amber-400 group-hover:rotate-12 transition-transform" />
              <span className="font-bold uppercase text-[11px] tracking-wider">Log Open Temp</span>
           </button>
           <button onClick={() => setActiveShift('close')} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 group shadow-md">
              <Moon size={20} className="text-blue-400 group-hover:rotate-12 transition-transform" />
              <span className="font-bold uppercase text-[11px] tracking-wider">Log Close Temp</span>
           </button>
        </div>
      </header>

      {activeShift && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[130] flex items-center justify-center p-8">
          <div className="bg-white rounded-[40px] w-full max-w-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b-2 border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold tracking-widest uppercase flex items-center gap-4">
                {activeShift === 'open' ? <Sun className="text-amber-400" /> : <Moon className="text-blue-400" />}
                {String(activeShift).toUpperCase()} SHIFT TEMPERATURE LOG
              </h3>
              <button onClick={() => setActiveShift(null)} className="text-slate-500 hover:text-white transition-all"><X size={28} /></button>
            </div>
            <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto scrollbar-none">
               {EQUIPMENT_LIST.map(eq => (
                 <div key={eq.id} className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase truncate block">{eq.name}</label>
                   <input 
                    type="number" 
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 font-black text-lg text-center focus:border-emerald-500 outline-none transition-colors"
                    value={safety[activeShift][eq.id]} 
                    onChange={e => setSafety({ ...safety, [activeShift]: { ...safety[activeShift], [eq.id]: e.target.value } })}
                    placeholder="°F"
                   />
                 </div>
               ))}
            </div>
            <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex justify-end">
               <button onClick={() => setActiveShift(null)} className="px-10 py-4 bg-emerald-500 text-slate-900 font-bold rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-[11px] shadow-md">Save Shift Data</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-xl">
        <table className="w-full text-left min-w-[1200px]">
          <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em]">
            <tr>
              <th className="px-8 py-6">Equipment Identity</th>
              <th className="px-8 py-6">Ideal Range</th>
              <th className="px-8 py-6 text-center">Open Temp</th>
              <th className="px-8 py-6 text-center">Close Temp</th>
              <th className="px-8 py-6 text-right">Safety Status</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-50">
            {EQUIPMENT_LIST.map(eq => (
              <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5">
                  <p className="font-bold uppercase text-sm text-slate-800">{eq.name}</p>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-500 uppercase">
                    {eq.type === 'refrig' ? '33 - 40°F' : eq.type === 'freezer' ? '-10 - 5°F' : '140°F +'}
                  </span>
                </td>
                <td className="px-8 py-5 text-center">
                   <p className={`text-xl font-black ${getStatusColor(eq, safety.open[eq.id])}`}>
                     {safety.open[eq.id] ? `${safety.open[eq.id]}°` : '---'}
                   </p>
                </td>
                <td className="px-8 py-5 text-center">
                   <p className={`text-xl font-black ${getStatusColor(eq, safety.close[eq.id])}`}>
                     {safety.close[eq.id] ? `${safety.close[eq.id]}°` : '---'}
                   </p>
                </td>
                <td className="px-8 py-5 text-right">
                   {(!safety.open[eq.id] || !safety.close[eq.id]) ? (
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                   ) : (getStatusColor(eq, safety.open[eq.id]) === 'text-rose-500' || getStatusColor(eq, safety.close[eq.id]) === 'text-rose-500') ? (
                     <div className="flex items-center justify-end gap-2 text-rose-500"><AlertTriangle size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Warning</span></div>
                   ) : (
                     <div className="flex items-center justify-end gap-2 text-emerald-500"><ShieldCheck size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Optimal</span></div>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-900 rounded-[40px] p-8 shadow-2xl border-2 border-slate-800">
        <h3 className="text-white font-bold text-lg uppercase tracking-widest flex items-center gap-3 mb-6"><ShieldCheck className="text-emerald-400" /> Operational Readiness</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CheckToggle label="Steam table water level" active={safety.checks.steamTableWater} onToggle={() => setSafety({...safety, checks: {...safety.checks, steamTableWater: !safety.checks.steamTableWater}})} />
          <CheckToggle label="Fryer oil filtered and topped" active={safety.checks.fryerOil} onToggle={() => setSafety({...safety, checks: {...safety.checks, fryerOil: !safety.checks.fryerOil}})} />
          <CheckToggle label="Soup Croc Water Level" active={safety.checks.soupCrocWater} onToggle={() => setSafety({...safety, checks: {...safety.checks, soupCrocWater: !safety.checks.soupCrocWater}})} />
          <CheckToggle label="Equipment on and working" active={safety.checks.equipmentWorking} onToggle={() => setSafety({...safety, checks: {...safety.checks, equipmentWorking: !safety.checks.equipmentWorking}})} />
          <CheckToggle label="Sanitizer buckets filled" active={safety.checks.sanitizerBuckets} onToggle={() => setSafety({...safety, checks: {...safety.checks, sanitizerBuckets: !safety.checks.sanitizerBuckets}})} />
          <CheckToggle label="Heat lamps on" active={safety.checks.heatLampsOn} onToggle={() => setSafety({...safety, checks: {...safety.checks, heatLampsOn: !safety.checks.heatLampsOn}})} />
        </div>
      </div>
    </div>
  );
}

function Walkthrough({ inventory, onUpdate }) {
  const [selectedStorage, setSelectedStorage] = useState(WALK_ORDER[0]);
  const currentItems = inventory.filter(i => i.storage === selectedStorage);

  return (
    <div className="space-y-6 pb-32 animate-in slide-in-from-bottom duration-500">
      <header className="bg-slate-900 p-8 rounded-[40px] shadow-2xl border-b-4 border-emerald-500 sticky top-0 z-20 mx-1 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500 text-slate-900 rounded-2xl shadow-lg"><MapPin size={24} /></div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Inventory Walk</h2>
            <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">{selectedStorage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-hide">
          {WALK_ORDER.map((loc, idx) => (
            <button key={loc} onClick={() => setSelectedStorage(loc)} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap uppercase tracking-widest ${selectedStorage === loc ? 'bg-white text-slate-900 shadow-md scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
              {idx + 1}. {loc}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-6">
        {currentItems.map(item => {
          const cases = Math.floor((item.onHand || 0) / (item.caseSize || 1));
          const units = parseFloat(((item.onHand || 0) % (item.caseSize || 1)).toFixed(2));
          return (
            <div key={item.id} className="bg-white p-5 rounded-[30px] border-2 border-slate-100 shadow-md group hover:border-emerald-500 transition-all">
              <h4 className="font-bold text-xs leading-tight text-slate-800 uppercase line-clamp-2 h-8">{item.name}</h4>
              <p className="text-[9px] font-semibold text-slate-400 uppercase mb-4">{item.distributor} • {item.itemNum || 'No SKU'}</p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Cases</p>
                  <input type="number" className="w-full p-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-lg font-black text-center focus:border-emerald-500 outline-none transition-colors" value={cases || ''} onChange={(e) => onUpdate(item.id, 'onHand', (parseFloat(e.target.value) || 0) * (item.caseSize || 1) + units)} />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Units</p>
                  <input type="number" className="w-full p-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-lg font-black text-center focus:border-emerald-500 outline-none transition-colors" value={units || ''} onChange={(e) => onUpdate(item.id, 'onHand', (cases * (item.caseSize || 1)) + (parseFloat(e.target.value) || 0))} />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-slate-50 flex justify-between items-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Total: {item.onHand}</p>
                 {item.onHand < item.unitPar && <AlertTriangle size={14} className="text-rose-500 animate-pulse" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Receiving({ inventory, receipts, onReceive }) {
  const [activeModal, setActiveModal] = useState(null); 
  const [invoiceType, setInvoiceType] = useState('manual'); 
  const [singleForm, setSingleForm] = useState({ itemId: '', cases: '', units: '', price: '', invoiceNum: '' });
  const [invoiceNum, setInvoiceNum] = useState('');
  const [manualRows, setManualRows] = useState([{ id: 1, itemId: '', cases: '', units: '', price: '' }]);

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!singleForm.itemId || !singleForm.price || !singleForm.invoiceNum) return;
    onReceive([singleForm]);
    setActiveModal(null);
    setSingleForm({ itemId: '', cases: '', units: '', price: '', invoiceNum: '' });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!invoiceNum) return;
    const validRows = manualRows.filter(r => r.itemId && r.price);
    const data = validRows.map(r => ({ ...r, invoiceNum }));
    onReceive(data);
    setActiveModal(null);
    setInvoiceNum('');
    setManualRows([{ id: 1, itemId: '', cases: '', units: '', price: '' }]);
  };

  const addRow = () => setManualRows([...manualRows, { id: Date.now(), itemId: '', cases: '', units: '', price: '' }]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl flex justify-between items-center relative overflow-hidden">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Receiving Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Delivery Check-in • Procurement Audit</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setActiveModal('single')} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-md">
             <PackageCheck size={20} className="text-emerald-400" />
             <span className="font-bold uppercase tracking-wider text-[11px]">Quick Check-In</span>
          </button>
          <button onClick={() => setActiveModal('invoice')} className="bg-emerald-50 text-emerald-700 border-2 border-emerald-200 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl hover:bg-emerald-100 transition-all active:scale-95 shadow-sm">
             <FileText size={20} />
             <span className="font-bold uppercase tracking-wider text-[11px]">Invoice Entry</span>
          </button>
        </div>
      </header>

      {activeModal === 'single' && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[130] flex items-center justify-center p-8">
          <form onSubmit={handleSingleSubmit} className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b-2 border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold uppercase tracking-widest flex items-center gap-3"><PackageCheck className="text-emerald-400" /> Single SKU Check-In</h3>
                <button type="button" onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-all"><X size={28} /></button>
             </div>
             <div className="p-8 space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Number</label>
                   <input required type="text" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-lg border-2 border-slate-200 uppercase focus:border-emerald-500 outline-none" value={singleForm.invoiceNum} onChange={e => setSingleForm({...singleForm, invoiceNum: e.target.value})} placeholder="INV-0000" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Select Product</label>
                   <select required className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm border-2 border-slate-200 uppercase focus:border-emerald-500 outline-none" value={singleForm.itemId} onChange={e => setSingleForm({...singleForm, itemId: e.target.value, price: inventory.find(i => i.id === e.target.value)?.costPerCase || ''})}>
                      <option value="">Search Inventory SKUs...</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{(i.name || '').toUpperCase()}</option>)}
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Cases Received</label>
                     <input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xl text-center border-2 border-slate-200 focus:border-emerald-500 outline-none" value={singleForm.cases} onChange={e => setSingleForm({...singleForm, cases: e.target.value})} placeholder="0" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Loose Units</label>
                     <input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-xl text-center border-2 border-slate-200 focus:border-emerald-500 outline-none" value={singleForm.units} onChange={e => setSingleForm({...singleForm, units: e.target.value})} placeholder="0" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Unit Price</label>
                   <input required type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-xl font-black text-2xl text-emerald-600 border-2 border-slate-200 focus:border-emerald-500 outline-none" value={singleForm.price} onChange={e => setSingleForm({...singleForm, price: e.target.value})} placeholder="0.00" />
                </div>
                <div className="pt-4">
                  <button type="submit" className="w-full py-5 bg-emerald-500 text-slate-900 font-bold rounded-2xl shadow-md hover:bg-emerald-400 transition-all uppercase tracking-widest text-[11px]">Store Receipt & Update Stock</button>
                </div>
             </div>
          </form>
        </div>
      )}

      {activeModal === 'invoice' && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[130] flex items-center justify-center p-8">
          <div className="bg-white rounded-[50px] w-full max-w-5xl overflow-hidden shadow-2xl relative h-[85vh] flex flex-col animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b-2 border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold uppercase tracking-widest flex items-center gap-3"><FileText className="text-emerald-400" /> Full Invoice Entry</h3>
                <div className="flex gap-3 mr-8">
                   <button onClick={() => setInvoiceType('manual')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceType === 'manual' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Manual List</button>
                   <button onClick={() => setInvoiceType('pdf')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceType === 'pdf' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>PDF Upload</button>
                </div>
                <button type="button" onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors"><X size={28} /></button>
             </div>

             <div className="flex-1 overflow-y-auto p-8 scrollbar-none bg-slate-50/50">
                {invoiceType === 'pdf' ? (
                  <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[30px] space-y-6 bg-white">
                     <div className="p-6 bg-blue-50 rounded-full text-blue-400"><Upload size={48} /></div>
                     <div className="text-center">
                        <p className="font-black text-lg text-slate-700 uppercase">Drop Invoice PDF Here</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Compatible with US Foods & Performance portals</p>
                     </div>
                     <input type="file" className="hidden" id="invoice-upload" accept="application/pdf" />
                     <label htmlFor="invoice-upload" className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-800 transition-colors shadow-md">Select File</label>
                  </div>
                ) : (
                  <form onSubmit={handleManualSubmit} className="space-y-6">
                     <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
                       <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Invoice Identifier</label>
                       <input required type="text" className="w-1/2 p-3 bg-slate-50 rounded-xl font-bold text-lg border-2 border-slate-200 uppercase focus:border-emerald-500 outline-none" value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} placeholder="e.g., INV-0000" />
                     </div>

                     <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-widest border-b-2 border-slate-50 pb-2">Line Items</p>
                        {manualRows.map((row) => (
                          <div key={row.id} className="grid grid-cols-12 gap-3 items-center">
                             <div className="col-span-5">
                                <select required className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-[10px] uppercase outline-none focus:border-emerald-500 text-slate-700" value={row.itemId} onChange={e => setManualRows(manualRows.map(r => r.id === row.id ? {...r, itemId: e.target.value, price: inventory.find(i => i.id === e.target.value)?.costPerCase || ''} : r))}>
                                   <option value="">Select SKU...</option>
                                   {inventory.map(i => <option key={i.id} value={i.id}>{(i.name || '').toUpperCase()}</option>)}
                                </select>
                             </div>
                             <div className="col-span-2">
                                <input type="number" placeholder="Cases" className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-center text-xs outline-none focus:border-emerald-500" value={row.cases} onChange={e => setManualRows(manualRows.map(r => r.id === row.id ? {...r, cases: e.target.value} : r))} />
                             </div>
                             <div className="col-span-2">
                                <input type="number" placeholder="Units" className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-center text-xs outline-none focus:border-emerald-500" value={row.units} onChange={e => setManualRows(manualRows.map(r => r.id === row.id ? {...r, units: e.target.value} : r))} />
                             </div>
                             <div className="col-span-2">
                                <input type="number" step="0.01" placeholder="Price $" className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-center text-xs outline-none focus:border-emerald-500" value={row.price} onChange={e => setManualRows(manualRows.map(r => r.id === row.id ? {...r, price: e.target.value} : r))} />
                             </div>
                             <div className="col-span-1 text-center">
                                <button type="button" onClick={() => setManualRows(manualRows.filter(r => r.id !== row.id))} className="p-2 text-rose-400 hover:text-rose-600 transition-colors bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                             </div>
                          </div>
                        ))}
                        <button type="button" onClick={addRow} className="w-full py-4 border-2 border-dashed border-emerald-200 rounded-xl font-bold text-emerald-600 uppercase tracking-widest text-[10px] hover:bg-emerald-50 transition-colors">+ Add Line Item</button>
                     </div>
                  </form>
                )}
             </div>

             <div className="p-6 bg-slate-100 border-t-2 border-slate-200 flex justify-end gap-4">
                <button onClick={() => setActiveModal(null)} className="px-8 py-4 font-bold uppercase text-slate-500 hover:text-slate-800 text-[10px] tracking-widest">Cancel</button>
                <button onClick={handleManualSubmit} className="px-10 py-4 bg-emerald-500 text-slate-900 font-bold rounded-xl shadow-md hover:bg-emerald-400 transition-all uppercase tracking-widest text-[11px]">Process & Check-In</button>
             </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-xl">
        <div className="p-6 bg-slate-900 text-white border-b-2 border-slate-800 flex justify-between items-center">
           <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-3"><Clock size={16} className="text-emerald-400" /> Recent Receipts</h3>
        </div>
        <table className="w-full text-left">
           <thead className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-[0.2em] border-b-2 border-slate-200">
              <tr><th className="px-8 py-6">Date</th><th className="px-8 py-6">Invoice #</th><th className="px-8 py-6">Product Details</th><th className="px-8 py-6">Qty Added</th><th className="px-8 py-6 text-right">Acquisition Cost</th></tr>
           </thead>
           <tbody className="divide-y-2 divide-slate-50">
              {receipts.length > 0 ? receipts.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                   <td className="px-8 py-5 font-bold text-slate-500 text-[11px]">{r.date}</td>
                   <td className="px-8 py-5 font-black text-blue-600 text-xs uppercase">{r.invoiceNum}</td>
                   <td className="px-8 py-5"><p className="font-bold uppercase text-xs text-slate-800 truncate max-w-[200px]">{r.itemName}</p><p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{r.vendor}</p></td>
                   <td className="px-8 py-5 font-black text-emerald-600 text-sm">+ {r.qty} {String(r.unit).toUpperCase()}</td>
                   <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">${Number(r.price).toFixed(2)} / CS</td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="p-20 text-center text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">No acquisitions logged</td></tr>
              )}
           </tbody>
        </table>
      </div>
    </div>
  );
}

function PrepHub({ prepItems, inventory, onUpdate, onAdd }) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const calculatePotential = (prepItem) => {
    if (!prepItem.ingredients || prepItem.ingredients.length === 0) return "TBD";
    const limits = prepItem.ingredients.map(ing => {
      const invItem = inventory.find(i => i.id === ing.id);
      if (!invItem || parseFloat(invItem.onHand || 0) === 0) return 0;
      const usableStock = parseFloat(invItem.onHand) * (parseFloat(invItem.yieldPct || 100) / 100);
      return usableStock / parseFloat(ing.qty);
    });
    return Math.floor(Math.min(...limits));
  };

  const openEditor = (item) => {
    setActiveItem({...item});
    setIsEditing(true);
  };

  const handleAddIngredient = (invItem) => {
    if (activeItem.ingredients.some(i => i.id === invItem.id)) return;
    setActiveItem({
      ...activeItem,
      ingredients: [...activeItem.ingredients, { id: invItem.id, name: invItem.name, qty: 1 }]
    });
  };

  return (
    <div className="space-y-6 pb-32 animate-in slide-in-from-right duration-700">
      <header className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Prep Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Technical Production Workflows</p>
        </div>
        <button onClick={() => { setActiveItem({ name: '', station: 'Prep Area', unit: 'Quarts', par: 1, batchSize: 1, servingsPerBatch: 1, ingredients: [], instructions: '', type: 'sauce' }); setIsEditing(true); }} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-md active:scale-95 group">
          <Plus size={20} className="text-emerald-400 group-hover:rotate-90 transition-transform" />
          <span className="font-bold uppercase tracking-widest text-[11px]">Register Recipe</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {prepItems.map(p => {
           const isLow = p.onHand < p.par;
           const possible = calculatePotential(p);
           return (
            <div key={p.id} className={`p-6 rounded-[30px] border-2 shadow-lg relative overflow-hidden group transition-colors ${isLow ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-emerald-300'}`}>
               <button onClick={() => openEditor(p)} className={`absolute top-4 right-4 p-2 rounded-xl transition-colors z-10 ${isLow ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-emerald-500'}`}><Edit3 size={16} /></button>
               <div onClick={() => setViewingItem(p)} className="cursor-pointer">
                  <h4 className="font-black text-lg uppercase tracking-tight truncate pr-8">{p.name}</h4>
                  <p className={`font-bold text-[9px] uppercase tracking-widest mt-1 ${isLow ? 'text-slate-400' : 'text-slate-500'}`}>{p.station}</p>
                  <div className={`mt-6 pt-4 border-t-2 flex items-center justify-between ${isLow ? 'border-slate-800' : 'border-slate-50'}`}>
                    <div className="text-left font-black">
                      <p className={`text-2xl ${isLow ? 'text-emerald-400' : 'text-emerald-500'}`}>{isLow ? 'NEED' : 'READY'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-xl ${possible > 0 ? 'text-blue-500' : 'text-rose-500'}`}>{possible}</p>
                      <p className={`font-bold text-[8px] uppercase tracking-wider ${isLow ? 'text-slate-500' : 'text-slate-400'}`}>Batches</p>
                    </div>
                  </div>
               </div>
            </div>
           );
        })}
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
          <form onSubmit={e => { e.preventDefault(); if (activeItem.id) onUpdate(activeItem.id, activeItem); else onAdd(activeItem); setIsEditing(false); }} className="bg-white rounded-[50px] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b-2 border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase tracking-widest flex items-center gap-3">
                <Utensils className="text-emerald-400" />
                {activeItem.id ? 'Refine Recipe Specs' : 'Register New Recipe'}
              </h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white transition-colors"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 scrollbar-none bg-slate-50/50">
               <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Recipe Name</label>
                      <input required className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 uppercase focus:border-emerald-500 outline-none transition-colors" value={activeItem.name} onChange={e => setActiveItem({...activeItem, name: e.target.value})} placeholder="e.g. Bang Bang Sauce" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Batch Yield</label>
                         <input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 text-center focus:border-emerald-500 outline-none" value={activeItem.batchSize} onChange={e => setActiveItem({...activeItem, batchSize: e.target.value})} />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">Servings / Batch</label>
                         <input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 text-center focus:border-emerald-500 outline-none" value={activeItem.servingsPerBatch} onChange={e => setActiveItem({...activeItem, servingsPerBatch: e.target.value})} />
                       </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Station Assignment</label>
                      <select className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 uppercase focus:border-emerald-500 outline-none" value={activeItem.station} onChange={e => setActiveItem({...activeItem, station: e.target.value})}>
                        {PREP_STATIONS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Preparation Instructions</label>
                    <textarea className="w-full p-4 bg-slate-50 rounded-xl font-medium text-xs border-2 border-slate-200 h-32 focus:border-emerald-500 outline-none resize-none" value={activeItem.instructions} onChange={e => setActiveItem({...activeItem, instructions: e.target.value})} placeholder="Enter specific prep, plating, or storage instructions here..." />
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm flex flex-col h-full">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-slate-800 border-b-2 border-slate-100 pb-4 mb-4 flex justify-between items-center">
                    Linked Components
                  </h4>
                  <select className="w-full p-4 bg-slate-900 text-white rounded-xl font-bold text-[10px] tracking-wider outline-none mb-4 cursor-pointer shadow-md" onChange={e => { const inv = inventory.find(i => i.id === e.target.value); if (inv) handleAddIngredient(inv); }} value="">
                    <option value="">+ ADD INGREDIENT FROM INVENTORY</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{(i.name || '').toUpperCase()}</option>)}
                  </select>

                  <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-2">
                    {activeItem.ingredients.map(ing => (
                      <div key={ing.id} className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center justify-between group">
                        <div className="flex-1 mr-4">
                          <p className="font-bold text-xs uppercase text-slate-800 truncate mb-2">{ing.name}</p>
                          <div className="flex items-center gap-3">
                            <input type="number" step="0.01" className="w-20 p-2 text-center font-black text-sm bg-white border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500" value={ing.qty} onChange={e => setActiveItem({...activeItem, ingredients: activeItem.ingredients.map(x => x.id === ing.id ? {...x, qty: e.target.value} : x)})} />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Qty Per Batch</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setActiveItem({...activeItem, ingredients: activeItem.ingredients.filter(x => x.id !== ing.id)})} className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"><Trash2 size={function SalesTracking({ menuItems, monthlySales, selectedMonth, setSelectedMonth, updateSales, onAddMenu, onEditMenu, onDeleteMenu }) {
                            const currentSales = monthlySales[selectedMonth] || {};

                            const orderedSections = [
                              'Burgers & Sandwiches',
                              'From The Sea',
                              'Pasta',
                              'From The Oven',
                              'Flatbreads',
                              'Pub Grub',
                              'Chicken Wings',
                              'Salads',
                              'Sides'
                            ];

                            const sections = [...new Set(menuItems.map(m => m.section))].sort((a, b) => {
                              let indexA = orderedSections.indexOf(a);
                              let indexB = orderedSections.indexOf(b);
                              if(indexA === -1) indexA = 999;
                              if(indexB === -1) indexB = 999;
                              return indexA - indexB;
                            });

                            const summary = useMemo(() => {
                              let gross = 0; let cost = 0;
                              Object.values(currentSales).forEach(s => { gross += (parseFloat(s.sold || 0) * parseFloat(s.avgPrice || 0)); cost += (parseFloat(s.sold || 0) * parseFloat(s.cost || 0)); });
                              return { gross, profit: gross - cost, margin: gross > 0 ? ((gross - cost) / gross) * 100 : 0 };
                            }, [currentSales]);

                            return (
                              <div className="space-y-8 pb-32 animate-in fade-in duration-700">
                                 <header className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                                    <div>
                                      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Sales Tracking Hub</h2>
                                      <div className="mt-6 flex gap-4">
                                        <input type="month" className="bg-slate-50 rounded-xl px-4 py-3 font-bold text-slate-800 text-sm outline-none border-2 border-slate-200 focus:border-emerald-500 transition-colors" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <div className="text-right border-r-2 border-slate-200 pr-6">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Sales</p>
                                        <p className="text-3xl font-black text-emerald-600 tracking-tighter">${summary.gross.toFixed(0)}</p>
                                      </div>
                                      <button onClick={() => onAddMenu({ section: 'Burgers & Sandwiches', name: 'NEW MENU ITEM', price: 0 })} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-6 py-4 rounded-2xl active:scale-95 group hover:bg-slate-800 transition-colors shadow-md">
                                        <Plus size={20} className="text-emerald-400 group-hover:rotate-90 transition-transform" />
                                        <span className="font-bold uppercase text-[10px] tracking-wider">Add Item</span>
                                      </button>
                                    </div>
                                 </header>

                                 <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-xl mt-8 overflow-x-auto">
                                    <table className="w-full text-left min-w-[1200px]">
                                       <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em]">
                                          <tr>
                                            <th className="px-8 py-6 w-1/3">Menu Item</th>
                                            <th className="px-8 py-6 text-center">Unit Economics</th>
                                            <th className="px-8 py-6 text-center">Monthly Volume</th>
                                            <th className="px-8 py-6 text-right">Gross Sales</th>
                                            <th className="px-8 py-6 text-right pr-12">Total Profit</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y-2 divide-slate-50">
                                          {sections.map(section => (
                                            <React.Fragment key={section}>
                                              <tr className="bg-slate-100/50">
                                                <td colSpan="5" className="px-8 py-3 font-black text-slate-800 uppercase tracking-[0.2em] text-[11px] border-l-4 border-emerald-500">{section}</td>
                                              </tr>
                                              {menuItems.filter(m => m.section === section).map(item => {
                                                 const sale = currentSales[item.id] || { sold: 0, avgPrice: item.price, cost: 0 };
                                                 const soldCount = parseFloat(sale.sold || 0);
                                                 const gross = soldCount * parseFloat(sale.avgPrice || 0);
                                                 const profit = (parseFloat(sale.avgPrice || 0) - parseFloat(sale.cost || 0)) * soldCount;
                                                 return (
                                                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                     <td className="px-8 py-5">
                                                       <div className="flex items-center gap-4">
                                                         <button onClick={() => onDeleteMenu(item.id)} className="p-2 text-rose-300 hover:bg-rose-100 hover:text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                                         <div className="flex-1">
                                                           <input className="bg-transparent border-none p-1 w-full font-bold uppercase tracking-tight text-sm text-slate-800 outline-none hover:bg-white focus:bg-white rounded transition-colors" value={item.name} onChange={e => onEditMenu(item.id, 'name', e.target.value)} />
                                                         </div>
                                                       </div>
                                                     </td>
                                                     <td className="px-8 py-5">
                                                       <div className="flex justify-center gap-4">
                                                         <div className="flex items-center gap-2 bg-white rounded-lg p-2 border-2 border-slate-100 shadow-sm">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Sale:</span>
                                                            <div className="flex items-center text-slate-800 font-black text-sm"><DollarSign size={12}/> <input type="number" step="0.01" className="bg-transparent border-none p-0 w-12 outline-none" value={item.price} onChange={e => onEditMenu(item.id, 'price', e.target.value)} /></div>
                                                         </div>
                                                         <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2 border-2 border-emerald-100 shadow-sm">
                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase">Cost:</span>
                                                            <div className="flex items-center text-emerald-800 font-black text-sm"><DollarSign size={12}/> <input type="number" step="0.01" className="bg-transparent border-none p-0 w-12 outline-none placeholder-emerald-300" placeholder="0.00" value={sale.cost} onChange={e => updateSales(item.id, 'cost', e.target.value)} /></div>
                                                         </div>
                                                       </div>
                                                     </td>
                                                     <td className="px-8 py-5">
                                                       <div className="flex justify-center gap-4">
                                                          <div className="flex flex-col items-center">
                                                             <input type="number" className="bg-slate-100 rounded-lg p-2 w-16 text-center font-black text-sm border-2 border-slate-200 focus:border-emerald-500 outline-none transition-colors" value={sale.sold} onChange={e => updateSales(item.id, 'sold', e.target.value)} placeholder="0" />
                                                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Sold Qty</p>
                                                          </div>
                                                          <div className="flex flex-col items-center">
                                                             <input type="number" step="0.01" className="bg-white rounded-lg p-2 w-16 text-center font-black text-sm border-2 border-slate-200 focus:border-emerald-500 outline-none transition-colors" value={sale.avgPrice} onChange={e => updateSales(item.id, 'avgPrice', e.target.value)} placeholder="0.00" />
                                                             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Avg Rec'd</p>
                                                          </div>
                                                       </div>
                                                     </td>
                                                     <td className="px-8 py-5 text-right">
                                                       <p className="text-xl font-black text-slate-800 tracking-tighter">${gross.toFixed(2)}</p>
                                                     </td>
                                                     <td className="px-8 py-5 text-right pr-12">
                                                       <p className={`text-2xl font-black tracking-tighter ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${profit.toFixed(0)}</p>
                                                     </td>
                                                  </tr>
                                                 )
                                              })}
                                            </React.Fragment>
                                          ))}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                            )
                          }
                        }

                          const CostingTool = ({ inventory }) => {
                            const [ingredients, setIngredients] = useState([]);
                            const [margin, setMargin] = useState(70);
                            const [buffer, setBuffer] = useState(5);
                            const [fixedOverhead, setFixedOverhead] = useState(0);
                            const [showAddMenu, setShowAddMenu] = useState(false);

                            const results = useMemo(() => {
                              const subtotal = ingredients.reduce((acc, i) => acc + (parseFloat(i.qty || 0) * parseFloat(i.cost || 0)), 0);
                              const withBuffer = subtotal * (1 + (parseFloat(buffer || 0) / 100));
                              const totalPlateCost = withBuffer + parseFloat(fixedOverhead || 0);
                              const suggestedPrice = totalPlateCost / (1 - (parseFloat(margin || 0) / 100));
                              return { subtotal, totalPlateCost, suggestedPrice, profit: suggestedPrice - totalPlateCost };
                            }, [ingredients, margin, buffer, fixedOverhead]);

                            return (
                              <div className="space-y-8 pb-32 animate-in slide-in-from-top duration-700">
                                 <header className="bg-white p-8 rounded-[45px] border-2 border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 -mr-10 -mt-10 rounded-full opacity-50"></div>
                                    <div className="relative z-10">
                                      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Costing Sandbox</h2>
                                      <div className="flex gap-8 mt-6">
                                         <div className="flex flex-col bg-slate-50 px-6 py-3 rounded-2xl border-2 border-slate-100">
                                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculated Plate Cost</p>
                                           <p className="text-3xl font-black text-slate-900 tracking-tighter mt-1">${results.totalPlateCost.toFixed(2)}</p>
                                         </div>
                                         <div className="flex flex-col bg-blue-50 px-6 py-3 rounded-2xl border-2 border-blue-100">
                                           <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Suggested Sale Price</p>
                                           <p className="text-3xl font-black text-blue-700 tracking-tighter mt-1">${results.suggestedPrice.toFixed(2)}</p>
                                         </div>
                                      </div>
                                    </div>

                                    <div className="relative z-10">
                                      <button onClick={() => setShowAddMenu(!showAddMenu)} className="bg-slate-900 text-white flex items-center justify-center gap-3 px-8 py-5 rounded-2xl hover:bg-slate-800 active:scale-95 transition-all shadow-md">
                                        <Plus size={24} className={`${showAddMenu ? 'rotate-45' : ''} transition-transform text-blue-400`} />
                                        <span className="font-bold uppercase tracking-widest text-[11px]">Add Ingredient</span>
                                      </button>

                                      {showAddMenu && (
                                        <div className="absolute top-full right-0 mt-4 w-72 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 border-slate-100 z-[200] overflow-hidden animate-in zoom-in-95 duration-200">
                                          <button onClick={() => { setIngredients([...ingredients, { id: Date.now(), name: '', distributor: '', itemNum: '', qty: 0, cost: 0, isMisc: true }]); setShowAddMenu(false); }} className="w-full p-5 text-left hover:bg-blue-50 transition-colors border-b-2 border-slate-50 flex items-center gap-4">
                                             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Plus size={16}/></div>
                                             <div>
                                               <p className="font-bold text-[11px] uppercase tracking-wider text-slate-800">Create Misc Item</p>
                                               <p className="text-[9px] font-medium text-slate-500 uppercase mt-1">Manual cost entry</p>
                                             </div>
                                          </button>
                                          <div className="p-3 bg-slate-50">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 pt-2">Inventory Catalog</p>
                                            <div className="max-h-60 overflow-y-auto scrollbar-thin">
                                              {inventory.map(item => (
                                                <button key={item.id} onClick={() => { setIngredients([...ingredients, { id: Date.now(), name: item.name, distributor: item.distributor, itemNum: item.itemNum, qty: 1, cost: parseFloat(calculateUnitCost(item)), isMisc: false }]); setShowAddMenu(false); }} className="w-full p-3 text-left hover:bg-white rounded-xl transition-colors flex items-center gap-3 group">
                                                  <Package size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                  <span className="text-[10px] font-bold text-slate-700 uppercase truncate group-hover:text-slate-900">{item.name}</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                 </header>

                                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                                    <div className="lg:col-span-2 bg-white rounded-[40px] border-2 border-slate-100 shadow-xl overflow-hidden">
                                       <div className="p-6 bg-slate-900 text-white flex items-center gap-3">
                                         <Utensils size={18} className="text-blue-400" />
                                         <h4 className="text-[11px] font-bold uppercase tracking-widest">Recipe Component Breakdown</h4>
                                       </div>
                                       <div className="p-8 space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin bg-slate-50/50">
                                          {ingredients.length > 0 ? ingredients.map(ing => (
                                            <div key={ing.id} className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm transition-colors hover:border-blue-200 group">
                                               <div className="flex items-center gap-4 mb-4">
                                                  <input className="flex-1 bg-transparent border-none font-black text-sm outline-none placeholder-slate-300 uppercase tracking-wide text-slate-800" placeholder="Ingredient Name" value={ing.name} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? {...x, name: e.target.value} : x))} />
                                                  <button onClick={() => setIngredients(ingredients.filter(x => x.id !== ing.id))} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                               </div>
                                               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                  <div className="space-y-1">
                                                     <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Distributor</label>
                                                     <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-[10px] outline-none focus:border-blue-500 uppercase text-slate-700" placeholder="Name" value={ing.distributor || ''} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? {...x, distributor: e.target.value} : x))} />
                                                  </div>
                                                  <div className="space-y-1">
                                                     <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">SKU #</label>
                                                     <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-bold text-[10px] outline-none focus:border-blue-500 uppercase text-slate-700" placeholder="ID" value={ing.itemNum || ''} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? {...x, itemNum: e.target.value} : x))} />
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                                                     <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Used Qty</label>
                                                        <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black text-center text-sm focus:border-blue-500 outline-none transition-colors" value={ing.qty} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? {...x, qty: e.target.value} : x))} />
                                                     </div>
                                                     <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Unit Cost ($)</label>
                                                        <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black text-center text-sm focus:border-blue-500 outline-none transition-colors text-emerald-700" value={ing.cost} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? {...x, cost: e.target.value} : x))} />
                                                     </div>
                                                  </div>
                                               </div>
                                            </div>
                                          )) : (
                                            <div className="p-20 text-center flex flex-col items-center justify-center opacity-60">
                                               <Boxes size={48} className="text-slate-300 mb-4" />
                                               <p className="font-bold text-xs text-slate-500 uppercase tracking-widest">Sandbox is empty.</p>
                                               <p className="text-[10px] font-medium text-slate-400 mt-2">Add ingredients to begin costing.</p>
                                            </div>
                                          )}
                                       </div>
                                    </div>

                                    <div className="space-y-6">
                                       <div className="bg-white rounded-[40px] border-2 border-slate-100 p-8 shadow-xl space-y-8">
                                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-100 pb-3">Financial Modifiers</p>
                                          <div className="space-y-8">
                                             <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Waste / Trim Factor</label>
                                                  <span className="text-sm font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-lg">{buffer}%</span>
                                                </div>
                                                <input type="range" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" min="0" max="25" step="1" value={buffer} onChange={e => setBuffer(e.target.value)} />
                                             </div>
                                             <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Labor / Overhead per Plate</label>
                                                  <DollarSign size={14} className="text-slate-400" />
                                                </div>
                                                <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-black text-xl text-center outline-none focus:border-blue-500 transition-colors" value={fixedOverhead} onChange={e => setFixedOverhead(e.target.value)} placeholder="0.00" />
                                             </div>
                                             <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                                                <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Target Profit Margin</label>
                                                  <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">{margin}%</span>
                                                </div>
                                                <input type="range" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" min="50" max="95" step="1" value={margin} onChange={e => setMargin(e.target.value)} />
                                             </div>
                                          </div>
                                       </div>

                                       <div className="bg-slate-900 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
                                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">Projected Gross Profit / Plate</p>
                                          <p className="text-5xl font-black text-white tracking-tighter">${results.profit.toFixed(2)}</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            );
                          };

                          function Catalog({ inventory, getUnitCost }) {
                            const [query, setQuery] = useState('');
                            const filtered = inventory.filter(i => (i.name || '').toLowerCase().includes(query.toLowerCase()));
                            return (
                              <div className="space-y-8 pb-32 animate-in fade-in duration-500">
                                <div className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                                  <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Master Catalog</h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Stored Stock Summary</p>
                                  </div>
                                  <div className="relative w-full md:w-auto">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input type="text" placeholder="Search SKU database..." className="pl-14 pr-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-200 outline-none focus:border-emerald-500 w-full font-bold text-sm transition-colors" value={query} onChange={(e) => setQuery(e.target.value)} />
                                  </div>
                                </div>
                                <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-xl overflow-x-auto">
                                  <table className="w-full text-left min-w-[1100px]">
                                    <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em]">
                                       <tr>
                                         <th className="px-8 py-6">Product Information</th>
                                         <th className="px-8 py-6">Storage Mapping</th>
                                         <th className="px-8 py-6">Stock Health</th>
                                         <th className="px-8 py-6">Vendor Details</th>
                                         <th className="px-8 py-6 text-right">Unit Pricing</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-slate-50">
                                       {filtered.map(item => (
                                         <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                           <td className="px-8 py-5">
                                             <p className="font-black text-slate-800 uppercase text-sm truncate max-w-[250px]">{item.name}</p>
                                             <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{item.category}</p>
                                           </td>
                                           <td className="px-8 py-5 text-slate-500 font-bold text-[11px] uppercase tracking-widest">{item.storage}</td>
                                           <td className="px-8 py-5">
                                             <span className={`inline-block font-black text-xs px-4 py-2 rounded-xl ${parseFloat(item.onHand) < parseFloat(item.unitPar) ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                               {item.onHand} / {item.unitPar} {String(item.unit || '').toUpperCase()}
                                             </span>
                                           </td>
                                           <td className="px-8 py-5 text-slate-500">
                                             <p className="font-bold uppercase text-[10px]">{item.distributor || '---'}</p>
                                             <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-widest">SKU: {item.itemNum || '---'}</p>
                                           </td>
                                           <td className="px-8 py-5 text-right font-black text-emerald-600 text-2xl tracking-tighter">
                                             ${getUnitCost(item)}
                                           </td>
                                         </tr>
                                       ))}
                                    </tbody>
                                </table></div>
                              </div>
                            );
                          };

                          function WasteLogger({ inventory, waste, onLog }) {
                            const [sid, setSid] = useState('');
                            const [qty, setQty] = useState('');
                            const [reason, setReason] = useState(WASTE_REASONS[0]);
                            const [isLogging, setIsLogging] = useState(false);

                            const reasonStats = useMemo(() => {
                              const counts = waste.reduce((acc, entry) => { acc[entry.reason] = (acc[entry.reason] || 0) + 1; return acc; }, {});
                              const total = waste.length || 1;
                              return Object.entries(counts).map(([name, count]) => ({ name, count, percent: (count / total) * 100 }));
                            }, [waste]);

                            const pieGradient = useMemo(() => {
                              let currentPerc = 0;
                              const colors = ['#10b981', '#f59e0b', '#f43f5e', '#3b82f6', '#64748b', '#ec4899'];
                              const parts = reasonStats.map((stat, i) => { const start = currentPerc; currentPerc += stat.percent; return `${colors[i % colors.length]} ${start}% ${currentPerc}%`; });
                              return parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#e2e8f0 0 100%)';
                            }, [reasonStats]);

                            return (
                              <div className="space-y-10 pb-32 animate-in fade-in duration-700">
                                <header className="bg-white p-10 rounded-[50px] border-2 border-slate-100 shadow-xl flex justify-between items-center relative overflow-hidden">
                                  <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Waste Hub</h2>
                                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Loss Tracking & Recovery</p>
                                  </div>
                                  <button onClick={() => setIsLogging(true)} className="bg-rose-500 text-white flex items-center justify-center gap-3 px-8 py-5 rounded-[25px] hover:bg-rose-600 active:scale-95 transition-all shadow-md">
                                    <Trash2 size={24} /> <span className="font-bold uppercase tracking-widest text-[11px]">Log Shrinkage</span>
                                  </button>
                                </header>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                  <div className="bg-slate-900 rounded-[40px] p-8 shadow-xl border-2 border-slate-800 flex items-center gap-8 relative group">
                                    <div className="w-28 h-28 rounded-full border-4 border-slate-800 relative overflow-hidden shrink-0" style={{ background: pieGradient }}></div>
                                    <div className="flex-1 space-y-3">
                                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">Loss Reasons</p>
                                      {reasonStats.length > 0 ? reasonStats.map((stat) => (
                                        <div key={stat.name} className="flex justify-between items-center">
                                          <span className="text-[10px] font-bold text-white uppercase">{stat.name}</span>
                                          <span className="text-[10px] font-black text-slate-400">{Math.round(stat.percent)}%</span>
                                        </div>
                                      )) : <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">No Data</p>}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded-[40px] p-8 border-2 border-slate-100 shadow-xl flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Primary Factor</p>
                                    <h3 className="text-3xl font-black text-slate-900 uppercase truncate">{reasonStats[0]?.name || 'N/A'}</h3>
                                  </div>
                                  <div className="bg-white rounded-[40px] p-8 border-2 border-slate-100 shadow-xl flex flex-col justify-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Recorded Incidents</p>
                                    <h3 className="text-5xl font-black text-rose-500 tracking-tighter">{waste.length}</h3>
                                  </div>
                                </div>

                                {isLogging && (
                                  <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[130] flex items-center justify-center p-8">
                                    <form onSubmit={e => { e.preventDefault(); onLog(sid, qty, reason); setIsLogging(false); setSid(''); setQty(''); }} className="bg-white rounded-[50px] w-full max-w-xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                                      <div className="p-8 border-b-2 border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                                        <h3 className="text-xl font-bold tracking-widest uppercase">Record Shrinkage</h3>
                                        <button type="button" onClick={() => setIsLogging(false)} className="text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
                                      </div>
                                      <div className="p-10 space-y-8">
                                        <div className="space-y-2">
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compromised Asset</label>
                                          <select required className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 outline-none uppercase text-xs focus:border-rose-400 transition-colors" value={sid} onChange={e => setSid(e.target.value)}>
                                            <option value="">Select Inventory Item...</option>
                                            {inventory.map(i => <option key={i.id} value={i.id}>{(i.name || '').toUpperCase()}</option>)}
                                          </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                          <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unit Quantity</label>
                                            <input required type="number" step="0.01" className="w-full p-4 bg-slate-50 rounded-xl font-black border-2 border-slate-200 outline-none text-2xl text-center focus:border-rose-400 transition-colors" placeholder="0.00" value={qty} onChange={e => setQty(e.target.value)} />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason Code</label>
                                            <select className="w-full p-4 bg-slate-50 rounded-xl font-bold border-2 border-slate-200 outline-none uppercase text-[10px] tracking-wider focus:border-rose-400 h-[68px] transition-colors" value={reason} onChange={e => setReason(e.target.value)}>
                                              {WASTE_REASONS.map(r => <option key={r} value={r}>{String(r).toUpperCase()}</option>)}
                                            </select>
                                          </div>
                                        </div>
                                        <div className="pt-4">
                                          <button type="submit" className="w-full py-5 bg-rose-500 text-white font-bold rounded-2xl shadow-md hover:bg-rose-600 transition-colors uppercase tracking-widest text-[11px]">Deduct from Inventory</button>
                                        </div>
                                      </div>
                                    </form>
                                  </div>
                                )}

                                <div className="bg-white rounded-[40px] border-2 border-slate-100 overflow-hidden shadow-xl mt-12">
                                  <table className="w-full text-left min-w-[1000px]">
                                    <thead className="bg-slate-900 text-white text-[9px] font-bold uppercase tracking-[0.2em]">
                                      <tr>
                                        <th className="px-10 py-6">Timestamp</th>
                                        <th className="px-10 py-6">Asset Detached</th>
                                        <th className="px-10 py-6">Context</th>
                                        <th className="px-10 py-6 text-right">Financial Impact</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-slate-50">
                                      {waste.length > 0 ? waste.map(w => (
                                        <tr key={w.id} className="hover:bg-rose-50/30 transition-colors group">
                                          <td className="px-10 py-6">
                                            <p className="text-slate-800 font-bold text-xs uppercase">{w.time}</p>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1">{w.date}</p>
                                          </td>
                                          <td className="px-10 py-6">
                                            <p className="font-black text-slate-800 uppercase tracking-tight text-sm truncate max-w-[300px]">{w.itemName}</p>
                                            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Lost {w.qty} {String(w.unit || '').toUpperCase()}</p>
                                          </td>
                                          <td className="px-10 py-6">
                                            <span className="px-4 py-2 bg-slate-100 text-rose-500 rounded-lg font-bold text-[9px] uppercase tracking-widest">{w.reason}</span>
                                          </td>
                                          <td className="px-10 py-6 text-right">
                                            <p className="text-xl font-black text-rose-500 tracking-tighter">-${(parseFloat(w.qty || 0) * parseFloat(w.unitCost || 0)).toFixed(2)}</p>
                                          </td>
                                        </tr>
                                      )) : (
                                        <tr><td colSpan="4" className="p-24 text-center text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">No waste recorded</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          };

                          function Management({ inventory, onUpdate }) {
                            const [search, setSearch] = useState('');
                            const [mode, setMode] = useState('control');
                            const [expandedId, setExpandedId] = useState(null);

                            const filtered = inventory.filter(i => (i.name || '').toLowerCase().includes(search.toLowerCase()));

                            return (
                              <div className="space-y-8 pb-32 animate-in slide-in-from-top duration-700 relative">
                                <header className="bg-white p-8 rounded-[40px] border-2 border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                                  <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Command Center</h2>
                                    <div className="flex gap-3 mt-6">
                                      <button onClick={() => { setMode('control'); setExpandedId(null); }} className={`px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${mode === 'control' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Control Settings</button>
                                      <button onClick={() => { setMode('pricing'); setExpandedId(null); }} className={`px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${mode === 'pricing' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Price Matrix</button>
                                    </div>
                                  </div>
                                  <div className="relative w-full md:w-auto">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" placeholder="Filter Database..." className="pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500 transition-colors w-full md:w-80" value={search} onChange={e => setSearch(e.target.value)} />
                                  </div>
                                </header>

                                <div className="space-y-4">
                                  {filtered.map(item => {
                                    const isExpanded = expandedId === item.id;
                                    return (
                                      <div key={item.id} className={`bg-white rounded-[30px] border-2 transition-all duration-300 overflow-hidden ${isExpanded ? 'border-emerald-400 shadow-xl' : 'border-slate-100 shadow-sm hover:border-slate-200'}`}>

                                        <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                                          <div className="flex-1 w-full text-center md:text-left">
                                            <h3 className="font-black uppercase text-lg text-slate-800">{item.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.category} • {item.distributor}</p>
                                          </div>

                                          {mode === 'control' ? (
                                            <div className="flex items-center gap-8 w-full md:w-auto justify-center md:justify-end">
                                              <div className="text-center md:text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Routing</p>
                                                <p className="font-bold text-sm text-slate-700 uppercase mt-1">{item.storage}</p>
                                              </div>
                                              <div className="text-center md:text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">System Par</p>
                                                <p className="font-black text-lg text-slate-900 mt-1">{item.unitPar}</p>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-8 w-full md:w-auto justify-center md:justify-end">
                                              <div className="text-center md:text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Case Price</p>
                                                <p className="font-bold text-sm text-slate-700 uppercase mt-1">${parseFloat(item.costPerCase || 0).toFixed(2)}</p>
                                              </div>
                                              <div className="text-center md:text-right">
                                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Unit Cost</p>
                                                <p className="font-black text-lg text-emerald-600 mt-1">${calculateUnitCost(item)}</p>
                                              </div>
                                            </div>
                                          )}

                                          <div className="shrink-0 w-full md:w-auto flex justify-center md:border-l-2 border-slate-100 md:pl-6">
                                            <button className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors ${isExpanded ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-200'}`}>
                                              {isExpanded ? <ChevronUp size={16} /> : <Edit3 size={16} />}
                                              {isExpanded ? 'Close Card' : 'Edit Info'}
                                            </button>
                                          </div>
                                        </div>

                                        {isExpanded && (
                                          <div className="bg-slate-50 p-6 sm:p-8 border-t-2 border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                            {mode === 'control' ? (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Storage Route</label>
                                                   <select className="w-full p-4 bg-white rounded-xl font-bold text-xs uppercase border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.storage} onChange={e => onUpdate(item.id, 'storage', e.target.value)}>
                                                      {WALK_ORDER.map(o => <option key={o} value={o}>{String(o).toUpperCase()}</option>)}
                                                   </select>
                                                </div>
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Station Alignment</label>
                                                   <input className="w-full p-4 bg-white rounded-xl font-bold text-xs uppercase border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.stockedAt || ''} onChange={e => onUpdate(item.id, 'stockedAt', e.target.value)} placeholder="e.g. Hot Line" />
                                                </div>
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Par Limit</label>
                                                   <input type="number" className="w-full p-4 bg-white rounded-xl font-black text-sm text-center border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.unitPar || ''} onChange={e => onUpdate(item.id, 'unitPar', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SKU Number</label>
                                                   <input className="w-full p-4 bg-white rounded-xl font-bold text-xs uppercase border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.itemNum || ''} onChange={e => onUpdate(item.id, 'itemNum', e.target.value)} placeholder="SKU ID" />
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price Per Case ($)</label>
                                                   <div className="relative">
                                                     <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                     <input type="number" step="0.01" className="w-full pl-12 p-4 bg-white rounded-xl font-black text-emerald-600 text-lg border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.costPerCase || ''} onChange={e => onUpdate(item.id, 'costPerCase', e.target.value)} />
                                                   </div>
                                                </div>
                                                <div className="space-y-2">
                                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Units / Case</label>
                                                   <input type="number" className="w-full p-4 bg-white rounded-xl font-black text-lg border-2 border-slate-200 outline-none focus:border-emerald-500 transition-colors" value={item.caseSize || ''} onChange={e => onUpdate(item.id, 'caseSize', e.target.value)} />
                                                </div>
                                                <div className="bg-emerald-100/50 p-4 rounded-xl border-2 border-emerald-200 flex flex-col justify-center items-center sm:items-end text-center sm:text-right">
                                                  <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Calculated Unit Cost</p>
                                                  <p className="text-2xl font-black text-emerald-600 tracking-tighter mt-1">${calculateUnitCost(item)}</p>
                                                </div>
                                              </div>
                                            )}
                                            <div className="mt-6 flex justify-end">
                                              <button onClick={() => setExpandedId(null)} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">Done Editing</button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}

                                  {filtered.length === 0 && (
                                    <div className="text-center p-12 bg-white rounded-[40px] border-2 border-slate-100 shadow-sm">
                                      <Search className="mx-auto text-slate-300 mb-4" size={40} />
                                      <h3 className="font-black text-lg text-slate-700 uppercase tracking-tight">No Items Found</h3>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Adjust your filters</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          export default App;