use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: parse-als <file.als>");
        std::process::exit(1);
    }

    match backtrack_parser::parse_file(&args[1]) {
        Ok(project) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&project).expect("failed to serialize result")
            );
        }
        Err(e) => {
            eprintln!("Error: {e}");
            std::process::exit(1);
        }
    }
}
