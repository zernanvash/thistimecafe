# POS & Inventory Database Setup Guide

This system is configured to use **SQLite** during local development and **MongoDB** for staging/production. 

---

## 1. Local Development (SQLite)

SQLite is configured out-of-the-box in Laravel 11. It is a file-based database that requires zero configuration, no background services, and no PHP extensions.

### Configuration
In `.env`, the database connection is set to:
```env
DB_CONNECTION=sqlite
```
The database file is automatically created at `database/database.sqlite`.

### Running Migrations & Seeding
To build the tables:
```bash
php artisan migrate
```

---

## 2. Production Deployment (MongoDB Atlas)

To configure the application for MongoDB (local or Atlas):

### Step A: Update Configuration
1. Open the `.env` file.
2. Comment out the SQLite settings:
   ```env
   # DB_CONNECTION=sqlite
   ```
3. Uncomment and update the MongoDB settings with your Atlas URI:
   ```env
   DB_CONNECTION=mongodb
   DB_URI=mongodb+srv://<username>:<password>@<cluster-url>/ttc_pos?retryWrites=true&w=majority
   DB_DATABASE=ttc_pos
   ```

---

## 3. Enabling MongoDB Extension in XAMPP (Optional)

If you wish to test MongoDB locally using XAMPP on Windows, you must install the official PHP `mongodb` extension.

### Step-by-Step Installation:

1. **Check PHP Version and Architecture:**
   * Open your command line and run: `php -v`
   * Check whether your system is **Thread Safe (TS)** or **Non-Thread Safe (NTS)**. (XAMPP on Windows is almost always **Thread Safe (ZTS)**, x64).

2. **Download the Driver DLL:**
   * Go to the official PECL Repository for MongoDB: [https://pecl.php.net/package/mongodb](https://pecl.php.net/package/mongodb)
   * Select the latest stable version compatible with **PHP 8.2** (since your environment runs PHP 8.2.12).
   * Click on the **DLL** link in the "Downloads" column.
   * Download the zip archive matching your system: **8.2 Thread Safe (TS) x64**.

3. **Install the DLL:**
   * Extract the zip archive and find `php_mongodb.dll`.
   * Copy `php_mongodb.dll` and paste it into your XAMPP extension folder: `C:\xampp\php\ext\`

4. **Enable the Extension in php.ini:**
   * Open your XAMPP Control Panel.
   * Click the **Config** button next to Apache, and select **PHP (php.ini)**.
   * Search for `extension=` or scroll down to the extensions section.
   * Add the following line:
     ```ini
     extension=mongodb
     ```
   * Save the file.

5. **Restart Apache:**
   * In XAMPP Control Panel, click **Stop** on Apache and **Start** it again.
   * Run `php -m | findstr mongodb` in the terminal to verify that the extension is successfully loaded.

---

## 4. Writing Database Models (Eloquent Compatibility)

To ensure our models work on both SQLite and MongoDB seamlessly, we will use standard Laravel Eloquent conventions.

When writing models that will be stored in MongoDB, they must extend `MongoDB\Laravel\Eloquent\Model` instead of the default Laravel model class when MongoDB is active.

### Switchable Model Abstraction (Example)
```php
<?php

namespace App\Models;

// We check if the active connection is mongodb to choose the base Model class dynamically
use Illuminate\Database\Eloquent\Model as EloquentModel;
use MongoDB\Laravel\Eloquent\Model as MongoModel;

class Product extends (config('database.default') === 'mongodb' ? MongoModel::class : EloquentModel::class)
{
    protected $connection = null; // Uses the default connection from .env

    protected $fillable = [
        'name',
        'category',
        'price',
        'cost',
        'sku',
        'stock',
    ];
}
```
This pattern allows us to write code once and have it run perfectly on SQLite locally and MongoDB Atlas in production.
