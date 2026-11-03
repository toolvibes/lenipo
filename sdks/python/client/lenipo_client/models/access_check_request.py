from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_permission import ProjectPermission
from ..models.space_permission import SpacePermission
from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="AccessCheckRequest")



@_attrs_define
class AccessCheckRequest:
    """ 
        Attributes:
            user (str):
            project_key (str | Unset):
            issue_key (str | Unset):
            permission (ProjectPermission | Unset):
            space_key (str | Unset):
            page_id (UUID | Unset):
            space_permission (SpacePermission | Unset):
     """

    user: str
    project_key: str | Unset = UNSET
    issue_key: str | Unset = UNSET
    permission: ProjectPermission | Unset = UNSET
    space_key: str | Unset = UNSET
    page_id: UUID | Unset = UNSET
    space_permission: SpacePermission | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        user = self.user

        project_key = self.project_key

        issue_key = self.issue_key

        permission: str | Unset = UNSET
        if not isinstance(self.permission, Unset):
            permission = self.permission.value


        space_key = self.space_key

        page_id: str | Unset = UNSET
        if not isinstance(self.page_id, Unset):
            page_id = str(self.page_id)

        space_permission: str | Unset = UNSET
        if not isinstance(self.space_permission, Unset):
            space_permission = self.space_permission.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "user": user,
        })
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key
        if issue_key is not UNSET:
            field_dict["issueKey"] = issue_key
        if permission is not UNSET:
            field_dict["permission"] = permission
        if space_key is not UNSET:
            field_dict["spaceKey"] = space_key
        if page_id is not UNSET:
            field_dict["pageId"] = page_id
        if space_permission is not UNSET:
            field_dict["spacePermission"] = space_permission

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        user = d.pop("user")

        project_key = d.pop("projectKey", UNSET)

        issue_key = d.pop("issueKey", UNSET)

        _permission = d.pop("permission", UNSET)
        permission: ProjectPermission | Unset
        if isinstance(_permission,  Unset):
            permission = UNSET
        else:
            permission = ProjectPermission(_permission)




        space_key = d.pop("spaceKey", UNSET)

        _page_id = d.pop("pageId", UNSET)
        page_id: UUID | Unset
        if isinstance(_page_id,  Unset):
            page_id = UNSET
        else:
            page_id = UUID(_page_id)




        _space_permission = d.pop("spacePermission", UNSET)
        space_permission: SpacePermission | Unset
        if isinstance(_space_permission,  Unset):
            space_permission = UNSET
        else:
            space_permission = SpacePermission(_space_permission)




        access_check_request = cls(
            user=user,
            project_key=project_key,
            issue_key=issue_key,
            permission=permission,
            space_key=space_key,
            page_id=page_id,
            space_permission=space_permission,
        )


        access_check_request.additional_properties = d
        return access_check_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
