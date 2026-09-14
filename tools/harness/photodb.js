/* Stand-in for src/lib/photodb.js. See ./publicdb.js for why. */
export * from '../../src/lib/photodb.js';
export async function getPhoto() { return null; }
export async function getPhotos() { return {}; }
export async function setPhoto() {}
export async function removePhoto() {}
