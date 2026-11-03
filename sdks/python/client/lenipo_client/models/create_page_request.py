from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_page_request_kind import CreatePageRequestKind
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_page_request_variables import CreatePageRequestVariables





T = TypeVar("T", bound="CreatePageRequest")



@_attrs_define
class CreatePageRequest:
    """ 
        Attributes:
            title (str):
            parent_id (None | Unset | UUID):
            kind (CreatePageRequestKind | Unset):
            template (str | Unset):
            variables (CreatePageRequestVariables | Unset):
     """

    title: str
    parent_id: None | Unset | UUID = UNSET
    kind: CreatePageRequestKind | Unset = UNSET
    template: str | Unset = UNSET
    variables: CreatePageRequestVariables | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_page_request_variables import CreatePageRequestVariables # noqa: PLC0415
        title = self.title

        parent_id: None | str | Unset
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        elif isinstance(self.parent_id, UUID):
            parent_id = str(self.parent_id)
        else:
            parent_id = self.parent_id

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        template = self.template

        variables: dict[str, Any] | Unset = UNSET
        if not isinstance(self.variables, Unset):
            variables = self.variables.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "title": title,
        })
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if kind is not UNSET:
            field_dict["kind"] = kind
        if template is not UNSET:
            field_dict["template"] = template
        if variables is not UNSET:
            field_dict["variables"] = variables

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_page_request_variables import CreatePageRequestVariables # noqa: PLC0415
        d = dict(src_dict)
        title = d.pop("title")

        def _parse_parent_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parent_id_type_0 = UUID(data)



                return parent_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))


        _kind = d.pop("kind", UNSET)
        kind: CreatePageRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CreatePageRequestKind(_kind)




        template = d.pop("template", UNSET)

        _variables = d.pop("variables", UNSET)
        variables: CreatePageRequestVariables | Unset
        if isinstance(_variables,  Unset):
            variables = UNSET
        else:
            variables = CreatePageRequestVariables.from_dict(_variables)




        create_page_request = cls(
            title=title,
            parent_id=parent_id,
            kind=kind,
            template=template,
            variables=variables,
        )


        create_page_request.additional_properties = d
        return create_page_request

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
