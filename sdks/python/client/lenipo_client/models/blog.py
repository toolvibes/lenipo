from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.blog_months_item import BlogMonthsItem
  from ..models.blog_post import BlogPost





T = TypeVar("T", bound="Blog")



@_attrs_define
class Blog:
    """ 
        Attributes:
            posts (list[BlogPost]):
            months (list[BlogMonthsItem]):
     """

    posts: list[BlogPost]
    months: list[BlogMonthsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.blog_months_item import BlogMonthsItem # noqa: PLC0415
        from ..models.blog_post import BlogPost # noqa: PLC0415
        posts = []
        for posts_item_data in self.posts:
            posts_item = posts_item_data.to_dict()
            posts.append(posts_item)



        months = []
        for months_item_data in self.months:
            months_item = months_item_data.to_dict()
            months.append(months_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "posts": posts,
            "months": months,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.blog_months_item import BlogMonthsItem # noqa: PLC0415
        from ..models.blog_post import BlogPost # noqa: PLC0415
        d = dict(src_dict)
        posts = []
        _posts = d.pop("posts")
        for posts_item_data in (_posts):
            posts_item = BlogPost.from_dict(posts_item_data)



            posts.append(posts_item)


        months = []
        _months = d.pop("months")
        for months_item_data in (_months):
            months_item = BlogMonthsItem.from_dict(months_item_data)



            months.append(months_item)


        blog = cls(
            posts=posts,
            months=months,
        )

        return blog

