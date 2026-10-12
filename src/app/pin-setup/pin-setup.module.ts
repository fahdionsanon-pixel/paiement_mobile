import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { PinSetupPage } from './pin-setup.page';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', component: PinSetupPage }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [PinSetupPage]
})
export class PinSetupPageModule {}