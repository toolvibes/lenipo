from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole
from ..models.transition_rules_assign import TransitionRulesAssign
from ..models.transition_rules_comment import TransitionRulesComment
from typing import cast

if TYPE_CHECKING:
  from ..models.transition_field_action import TransitionFieldAction





T = TypeVar("T", bound="TransitionRules")



@_attrs_define
class TransitionRules:
    """ 
        Attributes:
            only_assignee (bool):  Default: False.
            roles (list[ProjectRole]):
            subtasks_done (bool):  Default: False.
            blockers_done (bool):  Default: False.
            required_fields (list[str]):
            due_not_past (bool):  Default: False.
            assign (TransitionRulesAssign):  Default: TransitionRulesAssign.KEEP.
            field_actions (list[TransitionFieldAction]):
            watch (bool):  Default: False.
            screen (bool):  Default: False.
            comment (TransitionRulesComment):  Default: TransitionRulesComment.NONE.
     """

    roles: list[ProjectRole]
    required_fields: list[str]
    field_actions: list[TransitionFieldAction]
    only_assignee: bool = False
    subtasks_done: bool = False
    blockers_done: bool = False
    due_not_past: bool = False
    assign: TransitionRulesAssign = TransitionRulesAssign.KEEP
    watch: bool = False
    screen: bool = False
    comment: TransitionRulesComment = TransitionRulesComment.NONE





    def to_dict(self) -> dict[str, Any]:
        from ..models.transition_field_action import TransitionFieldAction # noqa: PLC0415
        only_assignee = self.only_assignee

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)



        subtasks_done = self.subtasks_done

        blockers_done = self.blockers_done

        required_fields = self.required_fields



        due_not_past = self.due_not_past

        assign = self.assign.value

        field_actions = []
        for field_actions_item_data in self.field_actions:
            field_actions_item = field_actions_item_data.to_dict()
            field_actions.append(field_actions_item)



        watch = self.watch

        screen = self.screen

        comment = self.comment.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "onlyAssignee": only_assignee,
            "roles": roles,
            "subtasksDone": subtasks_done,
            "blockersDone": blockers_done,
            "requiredFields": required_fields,
            "dueNotPast": due_not_past,
            "assign": assign,
            "fieldActions": field_actions,
            "watch": watch,
            "screen": screen,
            "comment": comment,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.transition_field_action import TransitionFieldAction # noqa: PLC0415
        d = dict(src_dict)
        only_assignee = d.pop("onlyAssignee")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in (_roles):
            roles_item = ProjectRole(roles_item_data)



            roles.append(roles_item)


        subtasks_done = d.pop("subtasksDone")

        blockers_done = d.pop("blockersDone")

        required_fields = cast(list[str], d.pop("requiredFields"))


        due_not_past = d.pop("dueNotPast")

        assign = TransitionRulesAssign(d.pop("assign"))




        field_actions = []
        _field_actions = d.pop("fieldActions")
        for field_actions_item_data in (_field_actions):
            field_actions_item = TransitionFieldAction.from_dict(field_actions_item_data)



            field_actions.append(field_actions_item)


        watch = d.pop("watch")

        screen = d.pop("screen")

        comment = TransitionRulesComment(d.pop("comment"))




        transition_rules = cls(
            only_assignee=only_assignee,
            roles=roles,
            subtasks_done=subtasks_done,
            blockers_done=blockers_done,
            required_fields=required_fields,
            due_not_past=due_not_past,
            assign=assign,
            field_actions=field_actions,
            watch=watch,
            screen=screen,
            comment=comment,
        )

        return transition_rules

