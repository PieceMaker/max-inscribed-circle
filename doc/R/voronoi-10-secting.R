library(ggplot2)
library(ggvoronoi)

shape <- data.frame(
  x = c(0, 1, 1, 2, 2, 3, 3, 0, 0),
  y = c(0, 0, 3, 3, 0, 0, 4, 4, 0),
  plot = 'Shape'
)
medialAxisCentral <- data.frame(
  x = c(
    0.5, 0.5,
    1+cos(seq(-pi, -3/2*pi, length.out = 625))/2,
    1, 2,
    2+cos(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    2.5, 2.5
  ),
  y = c(
    0.5, 3,
    3+sin(seq(-pi, -3/2*pi, length.out = 625))/2,
    3.5, 3.5,
    3+sin(seq(-3/2*pi, -2*pi, length.out = 625))/2,
    3, 0.5
  ),
  plot = 'Medial\nAxis'
)
medialAxisWings1 <- data.frame(
  x = c(0, 0.5, 1),
  y = c(0, 0.5, 0),
  plot = 'Medial\nAxis'
)
medialAxisWings2 <- data.frame(
  x = c(2, 2.5, 3),
  y = c(0, 0.5, 0),
  plot = 'Medial\nAxis'
)
medialAxisWings3 <- data.frame(
  x = c(0, 1-(2^0.5/2)/2),
  y = c(4, 3+(2^0.5/2)/2),
  plot = 'Medial\nAxis'
)
medialAxisWings4 <- data.frame(
  x = c(2+(2^0.5/2)/2, 3),
  y = c(3+(2^0.5/2)/2, 4),
  plot = 'Medial\nAxis'
)

sites <- data.frame(
  x = c(
    rep(0, 11), seq(0.3, 3, by = 0.3), rep(3, 10), seq(2.9, 2, by = -0.1), rep(2, 10), seq(1.9, 1, by = -0.1), rep(1, 10), seq(0.9, 0.1, by = -0.1)
  ),
  y = c(
    seq(0, 4, by = 0.4), rep(4, 10), seq(3.6, 0, by = -0.4), rep(0, 10), seq(0.3, 3, by = 0.3), rep(3, 10), seq(2.7, 0, by = -0.3), rep(0, 9)
  ),
  plot = 'Voronoi'
)

ggplot() +
  stat_voronoi(data = sites, aes(x, y), linetype = 'solid', geom = "path", col = 'red') +
  geom_path(data = shape, aes(x, y), linetype = 'solid', col = 'black') +
  geom_path(
    data = medialAxisCentral,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings1,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings2,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings3,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  geom_path(
    data = medialAxisWings4,
    aes(x, y), linetype = 'dashed', col = 'black'
  ) +
  coord_fixed() +
  # scale_linetype_manual(values = c("Shape" = "solid", "Medial\nAxis" = "dashed", "Voronoi" = "solid")) +
  guides(
    linetype = guide_legend(title = '')
  ) +
  theme_grey() +
  theme(
    axis.title = element_blank(),
    axis.ticks = element_blank(),
    axis.text = element_blank(),
    plot.background = element_rect(fill = '#DCDCDC'),
    legend.background = element_rect(fill = '#DCDCDC'),
    plot.margin = margin(0.1, 0.1, 0.1, 0.1, "cm"),
    panel.background = element_rect(fill = "#D3D3D3"),
    plot.title = element_text(hjust = 0.5)
  ) +
  labs(title = 'Voronoi 10-secting Edges')

ggsave(filename = 'images/voronoi-10-secting.png', height = 6, width = 6, dpi = 100)
