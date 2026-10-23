const { test, expect } = require('@playwright/test');

async function register(page, username) {
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.getByRole('button', { name: 'Belum punya akun? Daftar' }).click();
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Daftar' }).click();
    await expect(page.getByText(`@${username}`)).toBeVisible();
}

test('register, create board, create task, edit task, and drag task', async ({ page }) => {
    const suffix = Date.now().toString(36);
    await page.goto('/');
    await register(page, `e2e_${suffix}`);

    await page.getByRole('button', { name: 'Tambah Kolom' }).click();
    await page.getByLabel('Nama Kolom').fill('E2E Board');
    await page.getByRole('button', { name: 'Simpan Kolom' }).click();
    await expect(page.getByRole('heading', { name: /E2E Board/ })).toBeVisible();

    await page.getByRole('button', { name: 'Tambah Tugas' }).click();
    await page.getByLabel('Judul Tugas').fill('E2E Task');
    await page.getByRole('button', { name: 'Simpan Tugas' }).click();
    await expect(page.getByText('E2E Task')).toBeVisible();

    await page.getByText('E2E Task', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'E2E Task' })).toBeVisible();
    await page.getByLabel('Checklist baru').fill('E2E checklist');
    await page.locator('form').filter({ has: page.getByLabel('Checklist baru') }).getByRole('button', { name: 'Tambah', exact: true }).click();
    await expect(page.getByText('E2E checklist')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup detail tugas' }).click();

    await page.locator('.edit-btn').first().click();
    await page.getByLabel('Judul Tugas').fill('E2E Task Updated');
    await page.getByRole('button', { name: 'Simpan Tugas' }).click();
    await expect(page.getByText('E2E Task Updated')).toBeVisible();

    await page.getByRole('button', { name: 'Tambah Kolom' }).click();
    await page.getByLabel('Nama Kolom').fill('E2E Done');
    await page.getByRole('button', { name: 'Simpan Kolom' }).click();
    await expect(page.getByRole('heading', { name: /E2E Done/ })).toBeVisible();

    const task = page.locator('.task-card').filter({ hasText: 'E2E Task Updated' });
    const columns = page.locator('.board-column');
    const source = await task.boundingBox();
    const target = await columns.nth(1).locator('.task-list').boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 20, { steps: 12 });
    await page.mouse.up();
    await expect(columns.nth(1).getByText('E2E Task Updated')).toBeVisible();
});

test('anonymous legacy board remains usable', async ({ page }) => {
    const title = `Anonymous E2E ${Date.now().toString(36)}`;
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Tambah Kolom' })).toBeVisible();
    await page.getByRole('button', { name: 'Tambah Kolom' }).click();
    await page.getByLabel('Nama Kolom').fill(title);
    await page.getByRole('button', { name: 'Simpan Kolom' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
});
