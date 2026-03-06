const [events, setEvents] = useState([]);
const [dbReady, setDbReady] = useState(false);

useEffect(() => {
  loadFromSupabase()
    .then(data => {
      setEvents(data.length > 0 ? data : seed);
      setDbReady(true);
    })
    .catch(() => { setEvents(seed); setDbReady(true); });
}, []);

// Auto-save setiap kali events berubah
useEffect(() => {
  if (dbReady) saveToSupabase(events);
}, [events]);
