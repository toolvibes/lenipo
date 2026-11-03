from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.page_restrictions_view_groups_item import PageRestrictionsViewGroupsItem
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="PageRestrictionsView")



@_attrs_define
class PageRestrictionsView:
    """ 
        Attributes:
            users (list[UserRef]):
            groups (list[PageRestrictionsViewGroupsItem]):
     """

    users: list[UserRef]
    groups: list[PageRestrictionsViewGroupsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.page_restrictions_view_groups_item import PageRestrictionsViewGroupsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        users = []
        for users_item_data in self.users:
            users_item = users_item_data.to_dict()
            users.append(users_item)



        groups = []
        for groups_item_data in self.groups:
            groups_item = groups_item_data.to_dict()
            groups.append(groups_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "users": users,
            "groups": groups,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.page_restrictions_view_groups_item import PageRestrictionsViewGroupsItem # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        users = []
        _users = d.pop("users")
        for users_item_data in (_users):
            users_item = UserRef.from_dict(users_item_data)



            users.append(users_item)


        groups = []
        _groups = d.pop("groups")
        for groups_item_data in (_groups):
            groups_item = PageRestrictionsViewGroupsItem.from_dict(groups_item_data)



            groups.append(groups_item)


        page_restrictions_view = cls(
            users=users,
            groups=groups,
        )

        return page_restrictions_view

