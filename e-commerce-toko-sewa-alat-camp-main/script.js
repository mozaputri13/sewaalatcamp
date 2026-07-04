// ==========================================
// SCRIPT.JS - LOGIKA UTAMA KATALOG, KERANJANG, & ULASAN
// ==========================================

let cart = [];

// Effect Navbar Scroll
window.onscroll = function() {
    const nav = document.getElementById('navbar');
    if (document.documentElement.scrollTop > 100) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
};

// ==========================================
// 1. MEMUAT DATA PRODUK DINAMIS DARI SUPABASE
// ==========================================
async function fetchCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    // Periksa apakah Supabase Client terinisialisasi
    if (!supabaseClient) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #e63946; padding: 40px 0;">
                <p><strong>Gagal terhubung ke database.</strong><br>Silakan periksa konfigurasi di file <code>config.js</code>.</p>
            </div>
        `;
        return;
    }

    try {
        // SELECT data produk dari tabel alat_camp
        const { data, error } = await supabaseClient
            .from('alat_camp')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: #718096; padding: 40px 0;">
                    <p>Belum ada perlengkapan camp yang terdaftar saat ini.</p>
                </div>
            `;
            return;
        }

        // Urutkan agar produk terlaris (stok >= 15) berada di urutan pertama
        data.sort((a, b) => {
            const aTerlaris = a.stok >= 15;
            const bTerlaris = b.stok >= 15;
            if (aTerlaris && !bTerlaris) return -1;
            if (!aTerlaris && bTerlaris) return 1;
            return 0;
        });

        // Render card produk ke HTML
        grid.innerHTML = data.map(item => {
            // URL Gambar Handler (jika file lokal)
            const isLocalImage = !item.gambar_url.startsWith('http://') && !item.gambar_url.startsWith('https://');
            const finalImgUrl = isLocalImage ? encodeURI(item.gambar_url) : item.gambar_url;

            // Logika Penentuan Badge
            let badgeHTML = '';
            if (item.stok === 0) {
                badgeHTML = `<div class="badge" style="background: #e63946;">Habis</div>`;
            } else if (item.stok < 3) {
                badgeHTML = `<div class="badge" style="background: #ffb703; color: #2e2e2e;">Stok Tipis</div>`;
            } else if (item.stok >= 15) {
                badgeHTML = `<div class="badge">Terlaris</div>`;
            }

            // Tombol tambah sewa (disable jika stok kosong)
            const isOutOfStock = item.stok === 0;
            const btnHTML = isOutOfStock
                ? `<button class="btn-add" style="background: #a0aec0; cursor: not-allowed;" disabled>Stok Habis</button>`
                : `<button class="btn-add" onclick="addToCart('${item.nama_alat.replace(/'/g, "\\'")}', ${item.harga_sewa})">Tambah Keranjang</button>`;

            // Info sisa stok
            const stockHTML = isOutOfStock
                ? `<p style="color: #e63946; font-size: 0.85em; margin: 5px 0 10px 0;"><strong>Stok Habis</strong></p>`
                : `<p style="color: #2b6cb0; font-size: 0.85em; margin: 5px 0 10px 0;">Sisa Stok: <strong>${item.stok}</strong></p>`;

            return `
                <div class="product-card">
                    ${badgeHTML}
                    <div class="img-box" style="background-image: url('${finalImgUrl}');"></div>
                    <div class="product-detail">
                        <h3>${item.nama_alat}</h3>
                        <p class="price">Rp ${item.harga_sewa.toLocaleString('id-ID')} <span>/ hari</span></p>
                        ${stockHTML} 
                        ${btnHTML}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Gagal mengambil data produk:", err);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #e63946; padding: 40px 0;">
                <p>Gagal memuat katalog: ${err.message}</p>
            </div>
        `;
    }
}

// ==========================================
// 2. LOGIKA KERANJANG (CART FUNCTIONS)
// ==========================================
function addToCart(name, price) {
    cart.push({ name, price });
    updateUI();
    alert(`"${name}" berhasil ditambahkan ke keranjang.`);
}

function updateUI() {
    document.getElementById('cart-count').innerText = cart.length;
    const cartItems = document.getElementById('cart-items');
    const totalPriceEl = document.getElementById('total-price');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Keranjang kosong.</p>';
    } else {
        cartItems.innerHTML = cart.map((item, index) => `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <span>${item.name}</span>
                <strong>Rp ${item.price.toLocaleString('id-ID')}</strong>
            </div>
        `).join('');
    }
    
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    totalPriceEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

// Menampilkan/Tutup Modal Keranjang
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
}

// POTONG STOK OTOMATIS SAAT CHECKOUT WA
async function checkoutWA() {
    if (cart.length === 0) return alert("Pilih alat dulu!");
    
    const konfirmasi = confirm("Apakah Anda yakin ingin menyewa alat ini? Stok di web akan langsung terpotong secara otomatis.");
    if (!konfirmasi) return;

    try {
        // 1. Hitung total jumlah per item unik
        const itemCounts = {};
        cart.forEach(item => {
            itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
        });

        // 2. Lakukan perulangan untuk memotong data stok ke Supabase
        for (const name in itemCounts) {
            const jumlahBeli = itemCounts[name];

            const { data, error: fetchError } = await supabaseClient
                .from('alat_camp')
                .select('stok')
                .eq('nama_alat', name)
                .single();

            if (fetchError) throw fetchError;

            const stokSekarang = data.stok;
            const stokTerbaru = stokSekarang - jumlahBeli;

            if (stokTerbaru < 0) {
                alert(`Maaf ya, sisa stok untuk "${name}" tidak mencukupi untuk disewa.`);
                return; 
            }

            const { error: updateError } = await supabaseClient
                .from('alat_camp')
                .update({ stok: stokTerbaru })
                .eq('nama_alat', name);

            if (updateError) throw updateError;
        }

        // Catat status checkout sukses ke browser pembeli
        localStorage.setItem('sudahPernahCheckout', 'true');
        
        // Perbarui tampilan form ulasan agar langsung terbuka kuncinya
        updateReviewFormStatus();

        // 3. Susun isi pesan format otomatis untuk WhatsApp
        let text = "Halo SewaSewaan Jampang, saya ingin sewa:%0A";
        cart.forEach(item => text += `- ${item.name}%0A`);
        
        window.open(`https://wa.me/6281291028985?text=${text}`, '_blank');

        // Reset keranjang belanja
        cart = [];
        updateUI();
        toggleCart();
        
        await fetchCatalog(); 
        alert("Stok berhasil diperbarui! Silakan lanjutkan transaksi Anda di WhatsApp.");

    } catch (err) {
        console.error("Gagal melakukan pemotongan stok barang:", err);
        alert("Aduh, sistem gagal memproses stok: " + err.message);
    }
}

// ==========================================
// 3. ULASAN CUSTOMER - TERKONEKSI SUPABASE
// ==========================================

// Mengunci/Membuka Input Form Ulasan Secara Visual Menggunakan ID Akurat
function updateReviewFormStatus() {
    const nameInput = document.getElementById('rev-name');
    const textInput = document.getElementById('rev-text');
    const btnInput = document.getElementById('rev-btn'); 
    
    if (!nameInput || !textInput || !btnInput) return;

    const cekStatusCheckout = localStorage.getItem('sudahPernahCheckout');
    
    if (cekStatusCheckout === 'true') {
        // Jika sudah pernah beli, buka kuncinya
        nameInput.disabled = false;
        textInput.disabled = false;
        btnInput.disabled = false;
        btnInput.innerText = "Kirim Ulasan";
        btnInput.style.background = ""; // kembali ke warna asli di CSS
        btnInput.style.cursor = "pointer";
    } else {
        // Jika belum pernah beli, kunci total inputannya
        nameInput.disabled = true;
        textInput.disabled = true;
        btnInput.disabled = true;
        btnInput.innerText = "Sewa Dulu untuk Ulasan";
        btnInput.style.background = "#a0aec0"; // diubah jadi abu-abu penanda lock
        btnInput.style.cursor = "not-allowed";
    }
}

// Fungsi menampilkan ulasan dari Supabase
async function fetchReviews() {
    const list = document.getElementById('review-list');
    if (!list) return;

    try {
        const { data, error } = await supabaseClient
            .from('ulasan')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            list.innerHTML = data.map(item => `
                <div class="review-item">
                    <p>"${item.komentar}"</p>
                    <h5>— ${item.nama}</h5>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p style="text-align:center; color:#718096;">Belum ada ulasan. Jadilah yang pertama!</p>';
        }
    } catch (err) {
        console.error("Gagal mengambil data ulasan:", err);
    }
}

// Fungsi mengirim ulasan baru ke Supabase
async function addReview() {
    const cekStatusCheckout = localStorage.getItem('sudahPernahCheckout');
    if (!cekStatusCheckout || cekStatusCheckout !== 'true') {
        alert("Aduh maaf ya, kamu harus menyewa alat camp terlebih dahulu sebelum bisa memberikan ulasan! 😊");
        return;
    }

    const nameInput = document.getElementById('rev-name');
    const textInput = document.getElementById('rev-text');
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) {
        alert("Nama dan ulasan tidak boleh kosong ya!");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('ulasan')
            .insert([{ nama: name, komentar: text }]);

        if (error) throw error;

        nameInput.value = '';
        textInput.value = '';

        await fetchReviews();
        alert("Terima kasih! Ulasan Anda berhasil disimpan.");

    } catch (err) {
        console.error("Gagal menyimpan ulasan:", err);
        alert("Gagal mengirim ulasan: " + err.message);
    }
}

// Jalankan fungsi memuat Katalog, Ulasan, & Status Form saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();
    fetchReviews();
    updateReviewFormStatus(); // Jalankan proteksi form ulasan secara instan
});