package com.academicvault.app;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

import io.capawesome.capacitorjs.plugins.googlesignin.GoogleSignInPlugin;

public class MainActivity extends BridgeActivity {
	public MainActivity() {
		registerPlugin(GoogleSignInPlugin.class);
	}

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		EdgeToEdge.enable(this);
	}
}
