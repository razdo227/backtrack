//! Example: Compare two Ableton Live projects and show what changed
//!
//! Usage:
//!   cargo run --example diff_projects -- old.als new.als

use backtrack_parser::{diff_projects, parse_file};
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 3 {
        eprintln!("Usage: {} <old.als> <new.als>", args[0]);
        eprintln!("\nExample:");
        eprintln!("  cargo run --example diff_projects -- v1.als v2.als");
        std::process::exit(1);
    }

    let old_path = &args[1];
    let new_path = &args[2];

    println!("Comparing:");
    println!("  Old: {}", old_path);
    println!("  New: {}", new_path);
    println!();

    // Parse old project
    let old_project = match parse_file(old_path) {
        Ok(project) => project,
        Err(e) => {
            eprintln!("Error parsing old project: {}", e);
            std::process::exit(1);
        }
    };

    // Parse new project
    let new_project = match parse_file(new_path) {
        Ok(project) => project,
        Err(e) => {
            eprintln!("Error parsing new project: {}", e);
            std::process::exit(1);
        }
    };

    // Calculate diff
    let diff = diff_projects(&old_project, &new_project);

    // Display results
    if diff.is_empty() {
        println!("✨ No changes detected!\n");
        println!("Both projects are identical.");
    } else {
        println!(
            "📊 Found {} change{}\n",
            diff.change_count(),
            if diff.change_count() == 1 { "" } else { "s" }
        );
        println!("{}", diff.to_summary());
    }
}
